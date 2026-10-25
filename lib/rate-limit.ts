import "server-only";
import crypto from "node:crypto";
import { logServerEvent } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type RateLimitInput = {
  namespace: string;
  identifiers: Array<string | null | undefined>;
  limit: number;
  windowMs: number;
  localFallbackWhenConfiguredProviderFails?: boolean;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
};

type LocalWindow = { count: number; resetAt: number };
type RedisRestCredentials = { endpoint: string; token: string };
class RedisProviderError extends Error {
  constructor(readonly category: string) { super("Redis rate-limit request failed."); }
}
const localWindows = new Map<string, LocalWindow>();

export class RateLimitExceededError extends Error {
  constructor(public readonly result: RateLimitResult) {
    super("Too many requests. Please wait and try again.");
    this.name = "RateLimitExceededError";
  }
}

export class RateLimitUnavailableError extends Error {
  constructor() {
    super("Request protection is temporarily unavailable.");
    this.name = "RateLimitUnavailableError";
  }
}

function keySecret() {
  const value =
    process.env.RATE_LIMIT_KEY_SECRET ||
    process.env.SESSION_SIGNING_SECRET ||
    process.env.CSRF_SECRET;
  if (process.env.NODE_ENV === "production" && (!value || value.length < 32)) {
    throw new RateLimitUnavailableError();
  }
  return value || "greenchoice-local-rate-limit-key";
}

function safeKeyPart(value: string) {
  return crypto.createHmac("sha256", keySecret()).update(value.trim().toLowerCase()).digest("hex");
}

function rateLimitKey(input: RateLimitInput) {
  const identifiers = input.identifiers
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join("|");
  return `greenchoice:rl:${input.namespace}:${safeKeyPart(identifiers || "anonymous")}:${input.windowMs}`;
}

function localRateLimit(key: string, input: RateLimitInput): RateLimitResult {
  const now = Date.now();
  const current = localWindows.get(key);
  const next = !current || current.resetAt <= now
    ? { count: 1, resetAt: now + input.windowMs }
    : { count: current.count + 1, resetAt: current.resetAt };
  localWindows.set(key, next);
  const allowed = next.count <= input.limit;
  return {
    allowed,
    limit: input.limit,
    remaining: Math.max(0, input.limit - next.count),
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((next.resetAt - now) / 1000)),
    resetAt: next.resetAt
  };
}

function redisCredentialCandidates(): RedisRestCredentials[] {
  const candidates = [
    {
      endpoint: process.env.RATE_LIMIT_REDIS_REST_URL?.replace(/\/$/, ""),
      token: process.env.RATE_LIMIT_REDIS_REST_TOKEN
    },
    {
      endpoint: process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, ""),
      token: process.env.UPSTASH_REDIS_REST_TOKEN
    }
  ].filter((item): item is RedisRestCredentials => Boolean(item.endpoint && item.token));

  return candidates.filter((item, index, list) =>
    list.findIndex((candidate) => candidate.endpoint === item.endpoint && candidate.token === item.token) === index
  );
}

async function runDistributedRateLimit(key: string, input: RateLimitInput, credentials: RedisRestCredentials): Promise<RateLimitResult> {
  const response = await fetch(`${credentials.endpoint}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${credentials.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify([
      ["INCR", key],
      ["PEXPIRE", key, input.windowMs, "NX"],
      ["PTTL", key]
    ]),
    cache: "no-store",
    signal: AbortSignal.timeout(1_500)
  });
  if (!response.ok) {
    throw new RedisProviderError(response.status === 401 || response.status === 403
      ? "authentication"
      : response.status >= 500 ? "service_error" : "http_error");
  }

  const payload = await response.json() as Array<{ result?: number | null; error?: string }>;
  if (!Array.isArray(payload) || payload.some((item) => item?.error)) {
    throw new RateLimitUnavailableError();
  }
  const count = Number(payload[0]?.result);
  const ttl = Number(payload[2]?.result);
  if (!Number.isFinite(count) || !Number.isFinite(ttl)) throw new RateLimitUnavailableError();

  const now = Date.now();
  const ttlMs = ttl > 0 ? ttl : input.windowMs;
  const allowed = count <= input.limit;
  return {
    allowed,
    limit: input.limit,
    remaining: Math.max(0, input.limit - count),
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil(ttlMs / 1000)),
    resetAt: now + ttlMs
  };
}

function redisFailureCategory(error: unknown) {
  if (error instanceof RedisProviderError) return error.category;
  if (error instanceof Error && error.name === "TimeoutError") return "timeout";
  if (error instanceof TypeError) return "network";
  return "invalid_response";
}

async function runSupabaseRateLimit(key: string, input: RateLimitInput): Promise<RateLimitResult> {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new RateLimitUnavailableError();
  const { data, error } = await admin.rpc("consume_request_rate_limit", {
    p_key_hash: key,
    p_limit: input.limit,
    p_window_ms: input.windowMs
  });
  if (error || !Array.isArray(data) || data.length !== 1) throw new RateLimitUnavailableError();
  const count = Number(data[0]?.request_count);
  const resetAt = Date.parse(data[0]?.reset_at);
  if (!Number.isInteger(count) || count < 1 || !Number.isFinite(resetAt) || resetAt <= Date.now()) {
    throw new RateLimitUnavailableError();
  }
  const allowed = count <= input.limit;
  return {
    allowed,
    limit: input.limit,
    remaining: Math.max(0, input.limit - count),
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)),
    resetAt
  };
}

async function distributedRateLimit(key: string, input: RateLimitInput): Promise<RateLimitResult> {
  const candidates = redisCredentialCandidates();
  if (candidates.length === 0 && process.env.NODE_ENV === "production") {
    await logServerEvent("warn", "rate_limit_provider_failed", { service: "upstash_redis", category: "missing_configuration", namespace: input.namespace });
  }
  for (const [index, credentials] of candidates.entries()) {
    try {
      return await runDistributedRateLimit(key, input, credentials);
    } catch (error) {
      await logServerEvent("warn", "rate_limit_provider_failed", {
        service: "upstash_redis",
        provider: index === 0 ? "primary" : "secondary",
        category: redisFailureCategory(error),
        namespace: input.namespace
      });
    }
  }
  if (process.env.NODE_ENV === "production") {
    try {
      const result = await runSupabaseRateLimit(key, input);
      await logServerEvent("warn", "rate_limit_fallback_used", { service: "supabase_rpc", namespace: input.namespace });
      return result;
    } catch {
      await logServerEvent("error", "rate_limit_provider_failed", {
        service: "supabase_rpc",
        category: "unavailable_or_invalid_response",
        namespace: input.namespace
      });
      throw new RateLimitUnavailableError();
    }
  }
  if (candidates.length === 0 || input.localFallbackWhenConfiguredProviderFails) return localRateLimit(key, input);
  throw new RateLimitUnavailableError();
}

export async function consumeRateLimit(input: RateLimitInput) {
  if (!Number.isInteger(input.limit) || input.limit <= 0 ||
      !Number.isInteger(input.windowMs) || input.windowMs < 1000) {
    throw new Error("Invalid rate-limit configuration.");
  }
  return distributedRateLimit(rateLimitKey(input), input);
}

export async function requireRateLimit(input: RateLimitInput) {
  const result = await consumeRateLimit(input);
  if (!result.allowed) throw new RateLimitExceededError(result);
  return result;
}

export function rateLimitHeaders(result: RateLimitResult) {
  const headers: Record<string, string> = {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(Math.ceil(result.resetAt / 1000))
  };
  if (!result.allowed) headers["Retry-After"] = String(result.retryAfterSeconds);
  return headers;
}

export function trustedClientIp(headers: Headers) {
  if (process.env.VERCEL === "1") {
    const vercelForwarded = headers.get("x-vercel-forwarded-for");
    const forwarded = vercelForwarded || headers.get("x-forwarded-for");
    const first = forwarded?.split(",")[0]?.trim();
    return first || "vercel-unknown";
  }
  if (process.env.NODE_ENV !== "production") {
    return headers.get("x-real-ip")?.trim() || "local-development";
  }
  return "untrusted-proxy";
}

export function configuredRateLimit(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function resetLocalRateLimitsForTests() {
  if (process.env.NODE_ENV !== "test") throw new Error("Test-only rate-limit reset.");
  localWindows.clear();
}
