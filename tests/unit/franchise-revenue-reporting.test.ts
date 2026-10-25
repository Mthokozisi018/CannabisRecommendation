import { expect, it } from "vitest";
import { aggregateRevenuePeriods, availableRevenueYears, currentRevenueSelection, historicalReportingPeriod, isoWeekYear, revenueBuckets, revenueReportingRange, type RevenueSelection } from "@/lib/franchise/revenue-reporting";
import { periodStoreTotals } from "@/lib/franchise/overview-periods";
import { localDay, type FranchiseDailyTotal } from "@/lib/franchise/reporting";

const now = new Date("2026-10-13T12:00:00+02:00");
const history = "2024-02-01";
const select = (view: RevenueSelection["view"], year = 2026, month = 10) => ({ view, year, month });

it("automatically selects the current South African month and ISO reporting year", () => {
  const rollover = new Date("2027-01-01T00:01:00+02:00");
  expect(currentRevenueSelection("days", rollover)).toEqual({view:"days",year:2027,month:1});
  expect(currentRevenueSelection("weeks", rollover)).toEqual({view:"weeks",year:2026,month:1});
  expect(currentRevenueSelection("months", rollover)).toEqual({view:"months",year:2027,month:1});
  expect(revenueReportingRange(currentRevenueSelection("years", now), history, now).from).toBe(history);
});
const daily: FranchiseDailyTotal[] = [
  { store_id: "a", day: "2024-02-29", revenue: 20.1, transactions: 1 },
  { store_id: "a", day: "2025-12-29", revenue: .1, transactions: 1 },
  { store_id: "b", day: "2026-01-01", revenue: .2, transactions: 1 },
  { store_id: "a", day: "2026-10-12", revenue: 123.45, transactions: 1 },
  { store_id: "b", day: "2026-10-12", revenue: .3, transactions: 1 },
  { store_id: "a", day: "2026-10-13", revenue: 25.1, transactions: 1 },
  { store_id: "a", day: "2026-11-01", revenue: 9999, transactions: 1 },
];
it("uses the currently started ISO reporting year at New Year, including earliest-sale history", () => {
  expect(isoWeekYear("2021-01-01")).toBe(2020);
  expect(isoWeekYear("2024-12-31")).toBe(2025);
  const jan1 = new Date("2021-01-01T12:00:00+02:00");
  expect(availableRevenueYears("2021-01-01", jan1, "weeks")).toEqual([2020]);
  const range = revenueReportingRange(select("weeks", 2020), "2021-01-01", jan1);
  expect(range).toEqual({ from: "2021-01-01", to: "2021-01-01" });
  expect(historicalReportingPeriod(range, "2021-01-01", jan1).from).toBe("2021-01-01");
  expect(() => revenueBuckets(select("weeks", 2021), "2021-01-01", jan1)).toThrow();
  expect(availableRevenueYears("2024-02-01", new Date("2024-12-31T12:00:00+02:00"), "weeks")).toEqual([2024, 2025]);
});
it("renders every day including leap February and distinguishes future days", () => {
  expect(revenueBuckets(select("days", 2024, 2), history, now)).toHaveLength(29);
  expect(revenueBuckets(select("days", 2025, 2), history, now)).toHaveLength(28);
  const points = aggregateRevenuePeriods(daily, select("days"), history, now);
  expect(points).toHaveLength(13);
  expect(points[0]).toMatchObject({ label: "Day 1", value: 0 });
  expect(points[11].value).toBe(123.75);
  expect(points[12].value).toBe(25.1);
  expect(points.some(point => point.label === "Day 14")).toBe(false);
});
it("excludes every pre-sale bucket while retaining zero revenue after the first completed sale", () => {
  const first = "2026-06-18";
  const rows = [{store_id:"a",day:first,revenue:20,transactions:1}];
  expect(aggregateRevenuePeriods(rows, select("days",2026,6),first,now).map(point=>point.label)).toEqual(Array.from({length:13},(_,i)=>`Day ${i+18}`));
  const days = aggregateRevenuePeriods(rows,select("days",2026,6),first,now);
  expect(days[0].value).toBe(20); expect(days[1].value).toBe(0);
  expect(aggregateRevenuePeriods(rows,select("days",2026,5),first,now)).toEqual([]);
  expect(aggregateRevenuePeriods(rows,select("weeks"),first,now)[0].label).toBe("Week 25");
  expect(aggregateRevenuePeriods(rows,select("months"),first,now).map(point=>point.label)).toEqual(["June","July","August","September","October"]);
  expect(aggregateRevenuePeriods(rows,select("years"),first,now).map(point=>point.label)).toEqual(["2026"]);
  for (const view of ["days","weeks","months","years"] as const) expect(aggregateRevenuePeriods([],select(view),null,now)).toEqual([]);
});
it("uses ISO Monday–Sunday weeks, including 53-week years and cross-year transactions exactly once", () => {
  const buckets = revenueBuckets(select("weeks"), history, now);
  expect(buckets).toHaveLength(42);
  expect(buckets[0]).toEqual({ label: "Week 1", from: "2025-12-29", to: "2026-01-04" });
  expect(revenueBuckets(select("weeks"), history, new Date("2026-12-31T12:00:00+02:00"))[52]).toEqual({ label: "Week 53", from: "2026-12-28", to: "2027-01-03" });
  expect(revenueBuckets(select("weeks", 2025), history, now)).toHaveLength(52);
  const points = aggregateRevenuePeriods(daily, select("weeks"), history, now);
  expect(points[0].value).toBe(.3);
  expect(points[41].value).toBe(148.85);
  expect(points).toHaveLength(42);
  expect(points[41].tooltipLabel).toContain("in progress");
});
it("shows all months, zeros only inside started history, and only available annual years", () => {
  const months = aggregateRevenuePeriods(daily, select("months"), history, now);
  expect(months).toHaveLength(10);
  expect(months[0]).toMatchObject({ label: "January", value: .2 });
  expect(months[9]).toMatchObject({ label: "October", value: 148.85 });
  expect(months.some(point=>point.label === "November")).toBe(false);
  expect(aggregateRevenuePeriods(daily, select("months", 2024), history, now)[0]).toMatchObject({ label: "February", value: 20.1 });
  expect(availableRevenueYears(history, now)).toEqual([2024, 2025, 2026]);
  expect(aggregateRevenuePeriods(daily, select("years"), history, now).map((p) => p.value)).toEqual([20.1, .1, 149.05]);
  expect(aggregateRevenuePeriods([], select("years"), null, now)).toEqual([]);
  expect(availableRevenueYears(history, new Date("2027-01-01T00:00:00+02:00"))).toEqual([2024, 2025, 2026, 2027]);
});
it.each(["days", "weeks", "months", "years"] as const)("reconciles %s point totals with store totals for identical bounds", (view) => {
  const selection = select(view);
  const range = revenueReportingRange(selection, history, now);
  const points = aggregateRevenuePeriods(daily, selection, history, now);
  const pointCents = points.reduce((n, p) => n + Math.round((p.value || 0) * 100), 0);
  const storeCents = [...periodStoreTotals(daily, range).values()].reduce((n, s) => n + Math.round(s.revenue * 100), 0);
  expect(pointCents).toBe(storeCents);
});
it("uses South African date boundaries and rejects future years, months, invalid and pre-history dates", () => {
  expect(localDay("2026-10-12T22:01:00Z")).toBe("2026-10-13");
  expect(historicalReportingPeriod({ from: "2024-01-01", to: "2026-10-13" }, history, now).start.toISOString()).toBe("2023-12-31T22:00:00.000Z");
  for (const selection of [select("months", 2027), select("days", 2026, 11), select("months", 2023), select("days", 2026, 13)]) expect(() => revenueBuckets(selection, history, now)).toThrow();
  for (const range of [{ from: "2023-01-01", to: "2026-10-13" }, { from: "2024-02-30", to: "2026-10-13" }, { from: "2024-01-01", to: "2026-10-14" }]) expect(() => historicalReportingPeriod(range, history, now)).toThrow();
});


it("advances to January and ISO weeks in a new year while keeping historical revenue accessible", () => {
  const first="2026-06-18", january=new Date("2027-01-05T12:00:00+02:00");
  const rows=[{store_id:"a",day:first,revenue:7,transactions:1},{store_id:"a",day:"2027-01-04",revenue:5,transactions:1}];
  expect(aggregateRevenuePeriods(rows,select("months",2027,1),first,january)).toMatchObject([{label:"January",value:5}]);
  expect(aggregateRevenuePeriods(rows,select("weeks",2027,1),first,january)).toMatchObject([{label:"Week 1",value:5}]);
  expect(aggregateRevenuePeriods(rows,select("years",2027,1),first,january).map(point=>point.value)).toEqual([7,5]);
  expect(aggregateRevenuePeriods(rows,select("months",2026,6),first,january)[0].value).toBe(7);
});
