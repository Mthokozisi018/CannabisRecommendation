import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());
const scope = {
  userId: "a",
  franchiseId: "f",
  storeId: "s",
  from: "2026-10-01",
  to: "2026-10-13",
  calendarDay: "2026-10-13",
  customers: true,
};
const data = { daily: [], customers: [] };
it("invalidates store and whole-franchise reports after POS amendments, preserving other store entries", async () => {
  const { cachedFranchiseTotals, invalidateFranchiseStoreTotals } = await import("@/lib/franchise/totals-cache");
  const load = vi.fn().mockResolvedValue(data);
  for (const storeId of [scope.storeId, "other", undefined]) await cachedFranchiseTotals({...scope,storeId},load);
  invalidateFranchiseStoreTotals(scope.storeId);
  for (const storeId of [scope.storeId, "other", undefined]) await cachedFranchiseTotals({...scope,storeId},load);
  expect(load).toHaveBeenCalledTimes(5);
});
it("invalidates only the acting user's cached reports after mutations", async () => {
  const { cachedFranchiseTotals, invalidateFranchiseTotals } = await import("@/lib/franchise/totals-cache");
  const load = vi.fn().mockResolvedValue(data);
  await cachedFranchiseTotals(scope, load);
  await cachedFranchiseTotals({ ...scope, userId: "other" }, load);
  invalidateFranchiseTotals(scope.userId);
  await cachedFranchiseTotals(scope, load);
  await cachedFranchiseTotals({ ...scope, userId: "other" }, load);
  expect(load).toHaveBeenCalledTimes(3);
});
it("deduplicates in-flight work and refreshes after 15 seconds without serving stale failures", async () => {
  const { cachedFranchiseTotals } =
    await import("@/lib/franchise/totals-cache");
  const load = vi.fn().mockResolvedValue(data);
  await Promise.all([
    cachedFranchiseTotals(scope, load),
    cachedFranchiseTotals(scope, load),
  ]);
  expect(load).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(15001);
  load.mockRejectedValueOnce(Error("database unavailable"));
  await expect(cachedFranchiseTotals(scope, load)).rejects.toThrow(
    "database unavailable",
  );
  await expect(cachedFranchiseTotals(scope, load)).resolves.toEqual(data);
  expect(load).toHaveBeenCalledTimes(3);
});
it("isolates authenticated users, franchises, stores, ranges, calendar days and customer modes", async () => {
  const { cachedFranchiseTotals } =
    await import("@/lib/franchise/totals-cache");
  const load = vi.fn().mockResolvedValue(data);
  await cachedFranchiseTotals(scope, load);
  for (const change of [
    { userId: "b" },
    { franchiseId: "other" },
    { storeId: "other" },
    { from: "2026-09-01" },
    { to: "2026-10-14" },
    { calendarDay: "2026-10-14" },
    { customers: false },
  ])
    await cachedFranchiseTotals({ ...scope, ...change }, load);
  expect(load).toHaveBeenCalledTimes(8);
});
it("bounds retained entries and avoids retaining large reports", async () => {
  const { cachedFranchiseTotals } =
    await import("@/lib/franchise/totals-cache");
  const load = vi.fn().mockResolvedValue(data);
  for (let i = 0; i < 33; i++)
    await cachedFranchiseTotals({ ...scope, userId: String(i) }, load);
  await cachedFranchiseTotals({ ...scope, userId: "0" }, load);
  expect(load).toHaveBeenCalledTimes(34);
  const big = vi
    .fn()
    .mockResolvedValue({ daily: Array(5001).fill({}), customers: [] });
  await cachedFranchiseTotals(scope, big);
  await cachedFranchiseTotals(scope, big);
  expect(big).toHaveBeenCalledTimes(2);
});
