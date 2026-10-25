import { beforeEach, describe, expect, it, vi } from "vitest";

const redisCommands = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn()
}));
const RedisMock = vi.hoisted(() => vi.fn(function RedisConstructor() { return redisCommands; }));
const logServerEvent = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@upstash/redis", () => ({ Redis: RedisMock }));
vi.mock("@/lib/logger", () => ({ logServerEvent }));

describe("Redis cache resilience", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.invalid");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "redis-token");
    vi.stubEnv("GREENCHOICE_CACHE_REDIS_TIMEOUT_MS", "350");
    RedisMock.mockClear();
    logServerEvent.mockClear();
    redisCommands.get.mockReset();
    redisCommands.set.mockReset();
    redisCommands.del.mockReset();
  });

  it("bounds cache Redis requests and disables cache retries", async () => {
    const { getRedisClient } = await import("@/lib/cache/redis");

    expect(getRedisClient()).toBe(redisCommands);
    expect(RedisMock).toHaveBeenCalledWith(expect.objectContaining({
      retry: false,
      url: "https://redis.example.invalid",
      token: "redis-token",
      signal: expect.any(Function)
    }));
    const options = (RedisMock.mock.calls[0] as unknown as [{ signal: () => AbortSignal }] | undefined)?.[0];
    if (!options) throw new Error("Redis options were not captured.");
    expect(options.signal()).toBeInstanceOf(AbortSignal);
  });

  it("treats cache read failures as a logged cache miss", async () => {
    redisCommands.get.mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    const { cacheGet } = await import("@/lib/cache/redis");

    await expect(cacheGet("manager-dashboard-summary:store-1")).resolves.toBeNull();
    expect(logServerEvent).toHaveBeenCalledWith("warn", "redis_unavailable", expect.objectContaining({
      operation: "get",
      failureCategory: "temporary_service_failure"
    }));
  });
});
