import { afterEach, expect, it, vi } from "vitest";
import {
  createOverviewRangeLoader,
  overviewPeriod,
  overviewPeriodLabel,
  periodRevenueTrend,
  periodStoreTotals,
} from "@/lib/franchise/overview-periods";
import { summarizeDailyTotals } from "@/lib/franchise/reporting";
const now = new Date("2026-10-13T12:00:00+02:00");
afterEach(() => vi.useRealTimers());
it("uses South African days, Monday weeks, month/year starts and valid custom bounds", () => {
  expect(overviewPeriod("today", {}, new Date("2026-10-12T22:30:00Z"))).toEqual(
    { preset: "today", from: "2026-10-13", to: "2026-10-13" },
  );
  expect(overviewPeriod("week", {}, now)).toMatchObject({
    from: "2026-10-12",
    to: "2026-10-13",
  });
  expect(overviewPeriod("month", {}, now)).toMatchObject({
    from: "2026-10-01",
    to: "2026-10-13",
  });
  expect(overviewPeriod("year", {}, now)).toMatchObject({
    from: "2026-01-01",
    to: "2026-10-13",
  });
  expect(
    overviewPeriod("week", {}, new Date("2027-01-01T12:00:00+02:00")),
  ).toMatchObject({ from: "2026-12-28", to: "2027-01-01" });
  expect(() =>
    overviewPeriod("custom", { from: "2026-10-14", to: "2026-10-13" }, now),
  ).toThrow();
  expect(() =>
    overviewPeriod("custom", { from: "2026-02-30", to: "2026-03-01" }, now),
  ).toThrow();
  expect(() =>
    overviewPeriod("custom", { from: "2024-01-01", to: "2026-01-01" }, now),
  ).toThrow();
});
it("labels actual periods and custom dates without browser timezone dependence", () => {
  expect(overviewPeriodLabel(overviewPeriod("today", {}, now))).toBe(
    "Showing: Today — 13 October 2026",
  );
  expect(overviewPeriodLabel(overviewPeriod("month", {}, now))).toBe(
    "Showing: This Month — October 2026",
  );
  expect(overviewPeriodLabel(overviewPeriod("year", {}, now))).toBe(
    "Showing: This Year — 2026",
  );
  expect(
    overviewPeriodLabel(
      overviewPeriod("custom", { from: "2026-07-15", to: "2026-10-12" }, now),
    ),
  ).toBe("Showing: Custom Date Range — 15 July 2026 – 12 October 2026");
});
const daily = [
  { store_id: "a", day: "2026-01-01", revenue: "80.20", transactions: 1 },
  { store_id: "a", day: "2026-10-12", revenue: "123.45", transactions: 3 },
  { store_id: "b", day: "2026-10-12", revenue: "0.30", transactions: 1 },
  { store_id: "a", day: "2026-10-13", revenue: "25.10", transactions: 2 },
];
it("keeps independent chart/table ranges, cents, zero days and existing calendar KPIs accurate", () => {
  const today = overviewPeriod("today", {}, now),
    month = overviewPeriod("month", {}, now),
    year = overviewPeriod("year", {}, now);
  expect(periodStoreTotals(daily, today).get("a")).toEqual({
    revenue: 25.1,
    transactions: 2,
  });
  expect(periodStoreTotals(daily, month).get("a")).toEqual({
    revenue: 148.55,
    transactions: 5,
  });
  const trend = periodRevenueTrend(daily, month);
  expect(trend).toHaveLength(13);
  expect(trend[0].value).toBe(0);
  expect(trend[11].value).toBe(123.75);
  expect(periodRevenueTrend(daily, today)).toEqual([
    { label: "2026-10-13", value: 25.1 },
  ]);
  const summary = summarizeDailyTotals(
    daily,
    {
      ...year,
      start: new Date(`${year.from}T00:00:00+02:00`),
      end: new Date("2026-10-14T00:00:00+02:00"),
    },
    now,
  );
  expect(summary.month).toBe(148.85);
  expect(summary.week).toBe(148.85);
  expect(summary.year).toBe(229.05);
  expect(daily).toHaveLength(4);
});
it("deduplicates uncovered requests, reuses covered periods, expires them and retries failed reads", async () => {
  vi.useFakeTimers();
  const fetch = vi.fn().mockImplementation(async (p) => ({ ...p, daily: [] }));
  const load = createOverviewRangeLoader(
    { from: "2026-01-01", to: "2026-10-13", daily },
    fetch,
  );
  for (const preset of ["today", "week", "month", "year"] as const)
    await load(overviewPeriod(preset, {}, now));
  expect(fetch).not.toHaveBeenCalled();
  const historical = { from: "2025-05-01", to: "2025-05-31" };
  await Promise.all([load(historical), load(historical)]);
  expect(fetch).toHaveBeenCalledTimes(1);
  await load({ from: "2025-05-10", to: "2025-05-12" });
  expect(fetch).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(15001);
  fetch.mockRejectedValueOnce(Error("offline"));
  await expect(load(historical)).rejects.toThrow("offline");
  await load(historical);
  expect(fetch).toHaveBeenCalledTimes(3);
});
it("only reuses exact periods for pre-aggregated store category and table data", async () => {
  const initial = {
    from: "2026-10-01",
    to: "2026-10-13",
    categories: [{ label: "Flower", value: 100 }],
  };
  const fetch = vi.fn(async (period: { from: string; to: string }) => ({
    ...period,
    categories: [{ label: "Flower", value: 10 }],
  }));
  const load = createOverviewRangeLoader(initial, fetch, true);
  expect(await load(initial)).toBe(initial);
  const today = { from: "2026-10-13", to: "2026-10-13" };
  const results = await Promise.all([load(today), load(today)]);
  expect(results[0].categories[0].value).toBe(10);
  expect(fetch).toHaveBeenCalledTimes(1);
});
