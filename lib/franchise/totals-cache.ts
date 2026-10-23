import "server-only";
import type { FranchiseDailyTotal } from "./reporting";

export type DashboardTotals = {
  daily: FranchiseDailyTotal[];
  customers: { store_id: string; count: number | string }[];
};
type Scope = {
  userId: string;
  franchiseId: string;
  storeId?: string;
  from: string;
  to: string;
  calendarDay: string;
  customers: boolean;
};
const TTL_MS = 15_000;
const MAX_ENTRIES = 32;
const entries = new Map<
  string,
  { expires: number; promise: Promise<DashboardTotals> }
>();

export function invalidateFranchiseTotals(userId: string) {
  for (const key of entries.keys()) {
    if ((JSON.parse(key) as unknown[])[0] === userId) entries.delete(key);
  }
}

export function invalidateFranchiseStoreTotals(storeId: string) {
  for (const key of entries.keys()) {
    const scope = JSON.parse(key) as unknown[];
    // Whole-franchise reports have no store key. Evict those bounded entries too.
    if (scope[2] === null || scope[2] === storeId) entries.delete(key);
  }
}

// Best-effort instance-local cache. Authorization must run BEFORE every lookup.
// A new process simply reloads from RLS-protected Postgres. No stale fallback.
export function cachedFranchiseTotals(
  scope: Scope,
  load: () => Promise<DashboardTotals>,
) {
  const key = JSON.stringify([
    scope.userId,
    scope.franchiseId,
    scope.storeId || null,
    scope.from,
    scope.to,
    scope.calendarDay,
    scope.customers,
  ]);
  const now = Date.now();
  for (const [id, entry] of entries)
    if (entry.expires <= now) entries.delete(id);
  const hit = entries.get(key);
  if (hit) return hit.promise;
  if (entries.size >= MAX_ENTRIES) entries.delete(entries.keys().next().value!);
  const entry = {
    expires: now + TTL_MS,
    promise: Promise.resolve().then(load),
  };
  entry.promise = entry.promise.then(
    (data) => {
      // Large franchises still work but don't retain large payloads in memory.
      if (data.daily.length > 5000 || data.customers.length > 1000) {
        if (entries.get(key) === entry) entries.delete(key);
      } else entry.expires = Date.now() + TTL_MS;
      return data;
    },
    (error) => {
      if (entries.get(key) === entry) entries.delete(key);
      throw error;
    },
  );
  entries.set(key, entry);
  return entry.promise;
}
