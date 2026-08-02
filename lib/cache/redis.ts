import "server-only";

import { Redis } from "@upstash/redis";

let redisClient: Redis | null | undefined;

export const GREENCHOICE_CACHE_TTLS_SECONDS = {
  managerDashboardSummary: 120,
  posProducts: 180,
  productCategories: 600,
  lowStockSummary: 90,
  managerProducts: 120
} as const;

function keyPart(value: string | null | undefined) {
  const normalized = value?.trim() || "all";
  return encodeURIComponent(normalized.toLowerCase());
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
    redisClient = new Redis({ url, token });
  } catch {
    redisClient = null;
  }

  return redisClient;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    return await redis.get<T>(key);
  } catch {
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch {
    // Redis is only an accelerator. Supabase remains the source of truth.
  }
}

export async function cacheDelete(key: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.del(key);
  } catch {
    // Cache invalidation failures must not block committed Supabase writes.
  }
}

export function managerDashboardSummaryCacheKey(storeId: string) {
  return `manager-dashboard-summary:${keyPart(storeId)}`;
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

export async function invalidateManagerDashboardSummaryCache(storeId: string): Promise<void> {
  await cacheDelete(managerDashboardSummaryCacheKey(storeId));
}

export async function invalidateStoreDisplayCache(storeId: string): Promise<void> {
  await Promise.all([
    cacheDelete(managerDashboardSummaryCacheKey(storeId)),
    cacheDelete(posProductsCacheKey(storeId)),
    cacheDelete(productCategoriesCacheKey(storeId)),
    cacheDelete(lowStockSummaryCacheKey(storeId)),
    cacheDelete(managerProductsCacheKey(storeId))
  ]);
}
