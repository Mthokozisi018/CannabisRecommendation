import "server-only";
import crypto from "node:crypto";

type RateLimitInput = {
  namespace: string;
  identifiers: Array<string | null | undefined>;
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
};

type LocalWindow = { count: number; resetAt: number };
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

async function distributedRateLimit(key: string, input: RateLimitInput): Promise<RateLimitResult> {
  const endpoint = process.env.RATE_LIMIT_REDIS_REST_URL?.replace(/\/$/, "");
  const token = process.env.RATE_LIMIT_REDIS_REST_TOKEN;
  if (!endpoint || !token) {
    if (process.env.NODE_ENV === "production") throw new RateLimitUnavailableError();
    return localRateLimit(key, input);
  }

  const response = await fetch(`${endpoint}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify([
      ["INCR", key],
      ["PEXPIRE", key, input.windowMs, "NX"],
      ["PTTL", key]
    ]),
    cache: "no-store"
  });
  if (!response.ok) throw new RateLimitUnavailableError();

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
