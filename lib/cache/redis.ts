import "server-only";

import { Redis } from "@upstash/redis";
import { isTemporaryDependencyError, safeErrorName } from "@/lib/auth-errors";
import { logServerEvent } from "@/lib/logger";

let redisClient: Redis | null | undefined;
let lastRedisUnavailableLogAt = 0;
const REDIS_UNAVAILABLE_LOG_INTERVAL_MS = 30_000;
const DEFAULT_CACHE_REDIS_TIMEOUT_MS = 750;

export const GREENCHOICE_CACHE_TTLS_SECONDS = {
  managerDashboardSummary: 120,
  posProducts: 180,
  productCategories: 600,
  lowStockSummary: 90,
  managerProducts: 300,
  managerStaffAccounts: 120,
  receptionistSlotUsage: 120
} as const;

function keyPart(value: string | null | undefined) {
  const normalized = value?.trim() || "all";
  return encodeURIComponent(normalized.toLowerCase());
}

function cacheRedisTimeoutMs() {
  const configured = Number(process.env.GREENCHOICE_CACHE_REDIS_TIMEOUT_MS ?? DEFAULT_CACHE_REDIS_TIMEOUT_MS);
  if (!Number.isFinite(configured)) return DEFAULT_CACHE_REDIS_TIMEOUT_MS;
  return Math.min(2_000, Math.max(100, Math.round(configured)));
}

async function logRedisUnavailable(operation: string, error: unknown) {
  const now = Date.now();
  if (now - lastRedisUnavailableLogAt < REDIS_UNAVAILABLE_LOG_INTERVAL_MS) return;
  lastRedisUnavailableLogAt = now;
  await logServerEvent("warn", "redis_unavailable", {
    operation,
    failureCategory: isTemporaryDependencyError(error) ? "temporary_service_failure" : "cache_error",
    errorName: safeErrorName(error)
  });
}

export function getRedisClient() {
  if (redisClient !== undefined) return redisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    redisClient = null;
    return redisClient;
  }

  try {
    redisClient = new Redis({
      url,
      token,
      retry: false,
      signal: () => AbortSignal.timeout(cacheRedisTimeoutMs())
    });
  } catch (error) {
    void logRedisUnavailable("client_initialization", error);
    redisClient = null;
  }

  return redisClient;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    return await redis.get<T>(key);
  } catch (error) {
    await logRedisUnavailable("get", error);
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch (error) {
    await logRedisUnavailable("set", error);
    // Redis is only an accelerator. Supabase remains the source of truth.
  }
}

export async function cacheDelete(key: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.del(key);
  } catch (error) {
    await logRedisUnavailable("delete", error);
    // Cache invalidation failures must not block committed Supabase writes.
  }
}

export async function cacheDeleteMany(keys: string[]): Promise<void> {
  const redis = getRedisClient();
  const uniqueKeys = Array.from(new Set(keys.filter(Boolean)));
  if (!redis || uniqueKeys.length === 0) return;

  try {
    await redis.del(...uniqueKeys);
  } catch (error) {
    await logRedisUnavailable("delete_many", error);
    // Cache invalidation failures must not block committed Supabase writes.
  }
}

export function managerDashboardSummaryCacheKey(storeId: string) {
  return `manager-dashboard-summary:net-v1:${keyPart(storeId)}`;
}

export function posProductsCacheKey(storeId: string, category?: string, subcategory?: string) {
  return `pos-products:${keyPart(storeId)}:${keyPart(category)}:${keyPart(subcategory)}`;
}

export function productCategoriesCacheKey(storeId: string) {
  return `product-categories:${keyPart(storeId)}`;
}

export function lowStockSummaryCacheKey(storeId: string) {
  return `low-stock-summary:${keyPart(storeId)}`;
}

export function managerProductsCacheKey(storeId: string) {
  return `manager-products:${keyPart(storeId)}`;
}

export function managerStaffAccountsCacheKey(storeId: string) {
  return `manager-staff-accounts:${keyPart(storeId)}`;
}

export function receptionistSlotUsageCacheKey(storeId: string) {
  return `receptionist-slot-usage:${keyPart(storeId)}`;
}

export async function invalidateManagerDashboardSummaryCache(storeId: string): Promise<void> {
  await cacheDelete(managerDashboardSummaryCacheKey(storeId));
}

export async function invalidateManagerStaffCache(storeId: string): Promise<void> {
  await cacheDeleteMany([
    managerDashboardSummaryCacheKey(storeId),
    managerStaffAccountsCacheKey(storeId),
    receptionistSlotUsageCacheKey(storeId)
  ]);
}

export async function invalidateStoreDisplayCache(storeId: string): Promise<void> {
  await cacheDeleteMany([
    managerDashboardSummaryCacheKey(storeId),
    posProductsCacheKey(storeId),
    productCategoriesCacheKey(storeId),
    lowStockSummaryCacheKey(storeId),
    managerProductsCacheKey(storeId)
  ]);
}
