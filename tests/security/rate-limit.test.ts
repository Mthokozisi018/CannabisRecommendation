import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

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
});
