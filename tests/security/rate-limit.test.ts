import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const rateLimitMocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  logServerEvent: vi.fn().mockResolvedValue(undefined)
}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseAdminClient: rateLimitMocks.createSupabaseAdminClient }));
vi.mock("@/lib/logger", () => ({ logServerEvent: rateLimitMocks.logServerEvent }));

import {
  consumeRateLimit,
  RateLimitUnavailableError,
  resetLocalRateLimitsForTests
} from "@/lib/rate-limit";

describe("application rate limiter", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("RATE_LIMIT_REDIS_REST_URL", "");
    vi.stubEnv("RATE_LIMIT_REDIS_REST_TOKEN", "");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    rateLimitMocks.createSupabaseAdminClient.mockReturnValue(null);
    rateLimitMocks.logServerEvent.mockClear();
    resetLocalRateLimitsForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("enforces a local window in non-production tests", async () => {
    const input = {
      namespace: "security-test",
      identifiers: ["staff@example.invalid", "127.0.0.1"],
      limit: 2,
      windowMs: 60_000
    };

    expect((await consumeRateLimit(input)).allowed).toBe(true);
    expect((await consumeRateLimit(input)).allowed).toBe(true);
    const denied = await consumeRateLimit(input);
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
    expect(denied.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("fails closed in production when distributed storage is unavailable", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMIT_KEY_SECRET", "a-production-test-secret-that-is-long-enough");

    await expect(consumeRateLimit({
      namespace: "production-test",
      identifiers: ["anonymous"],
      limit: 2,
      windowMs: 60_000
    })).rejects.toBeInstanceOf(RateLimitUnavailableError);
  });

  it("fails closed when the distributed provider returns an error", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMIT_KEY_SECRET", "a-production-test-secret-that-is-long-enough");
    vi.stubEnv("RATE_LIMIT_REDIS_REST_URL", "https://redis.example.invalid");
    vi.stubEnv("RATE_LIMIT_REDIS_REST_TOKEN", "a-test-token-that-is-long-enough-for-production");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

    await expect(consumeRateLimit({
      namespace: "provider-error",
      identifiers: ["anonymous"],
      limit: 2,
      windowMs: 60_000
    })).rejects.toBeInstanceOf(RateLimitUnavailableError);
  });

  it("uses the Supabase service-role RPC when Redis is unavailable and enforces its limit", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMIT_KEY_SECRET", "a-production-test-secret-that-is-long-enough");
    vi.stubEnv("RATE_LIMIT_REDIS_REST_URL", "https://redis.example.invalid");
    vi.stubEnv("RATE_LIMIT_REDIS_REST_TOKEN", "test-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [{ request_count: 1, reset_at: new Date(Date.now() + 60_000).toISOString() }], error: null })
      .mockResolvedValueOnce({ data: [{ request_count: 2, reset_at: new Date(Date.now() + 60_000).toISOString() }], error: null });
    rateLimitMocks.createSupabaseAdminClient.mockReturnValue({ rpc });
    const input = { namespace: "login", identifiers: ["192.0.2.10"], limit: 1, windowMs: 60_000 };

    expect((await consumeRateLimit(input)).allowed).toBe(true);
    expect((await consumeRateLimit(input)).allowed).toBe(false);
    expect(rpc).toHaveBeenCalledWith("consume_request_rate_limit", expect.objectContaining({
      p_limit: 1, p_window_ms: 60_000,
      p_key_hash: expect.stringMatching(/^greenchoice:rl:login:[a-f0-9]{64}:60000$/)
    }));
    expect(rateLimitMocks.logServerEvent).toHaveBeenCalledWith("warn", "rate_limit_provider_failed", expect.objectContaining({ service: "upstash_redis" }));
    expect(rateLimitMocks.logServerEvent).toHaveBeenCalledWith("warn", "rate_limit_fallback_used", expect.objectContaining({ service: "supabase_rpc" }));
  });

  it("fails closed without a process-local bypass when Redis and Supabase both fail", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMIT_KEY_SECRET", "a-production-test-secret-that-is-long-enough");
    vi.stubEnv("RATE_LIMIT_REDIS_REST_URL", "https://redis.example.invalid");
    vi.stubEnv("RATE_LIMIT_REDIS_REST_TOKEN", "test-token");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    rateLimitMocks.createSupabaseAdminClient.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST301" } }) });
    await expect(consumeRateLimit({ namespace: "login", identifiers: ["192.0.2.11"], limit: 1, windowMs: 60_000, localFallbackWhenConfiguredProviderFails: true })).rejects.toBeInstanceOf(RateLimitUnavailableError);
    expect(rateLimitMocks.logServerEvent).toHaveBeenCalledWith("error", "rate_limit_provider_failed", expect.objectContaining({ service: "supabase_rpc" }));
  });

  it("uses shared Upstash Redis credentials when dedicated rate-limit credentials are not set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMIT_KEY_SECRET", "a-production-test-secret-that-is-long-enough");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://shared-redis.example.invalid/");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "a-shared-test-token-that-is-long-enough-for-production");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      { result: 1 },
      { result: 1 },
      { result: 60_000 }
    ]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await consumeRateLimit({
      namespace: "shared-upstash",
      identifiers: ["anonymous"],
      limit: 2,
      windowMs: 60_000
    });

    expect(result.allowed).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("https://shared-redis.example.invalid/pipeline", expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: "Bearer a-shared-test-token-that-is-long-enough-for-production"
      })
    }));
  });

  it("falls back to shared Upstash Redis when dedicated rate-limit Redis fails", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMIT_KEY_SECRET", "a-production-test-secret-that-is-long-enough");
    vi.stubEnv("RATE_LIMIT_REDIS_REST_URL", "https://rate-limit-redis.example.invalid");
    vi.stubEnv("RATE_LIMIT_REDIS_REST_TOKEN", "a-rate-limit-token-that-is-long-enough-for-production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://shared-redis.example.invalid");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "a-shared-test-token-that-is-long-enough-for-production");
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { result: 1 },
        { result: 1 },
        { result: 60_000 }
      ]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await consumeRateLimit({
      namespace: "fallback-upstash",
      identifiers: ["anonymous"],
      limit: 2,
      windowMs: 60_000
    });

    expect(result.allowed).toBe(true);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://rate-limit-redis.example.invalid/pipeline", expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://shared-redis.example.invalid/pipeline", expect.any(Object));
  });

  it("can use a local fallback for non-production business actions when configured providers are unavailable", async () => {
    vi.stubEnv("RATE_LIMIT_KEY_SECRET", "a-production-test-secret-that-is-long-enough");
    vi.stubEnv("RATE_LIMIT_REDIS_REST_URL", "https://rate-limit-redis.example.invalid");
    vi.stubEnv("RATE_LIMIT_REDIS_REST_TOKEN", "a-rate-limit-token-that-is-long-enough-for-production");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    const input = {
      namespace: "checkout-business-action",
      identifiers: ["staff-user"],
      limit: 1,
      windowMs: 60_000,
      localFallbackWhenConfiguredProviderFails: true
    };

    expect((await consumeRateLimit(input)).allowed).toBe(true);
    expect((await consumeRateLimit(input)).allowed).toBe(false);
  });
});
