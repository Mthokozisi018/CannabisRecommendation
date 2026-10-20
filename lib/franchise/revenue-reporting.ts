import { localDay, reportPeriod, type FranchiseDailyTotal } from "./reporting";

export const revenueViews = [["days", "Days"], ["weeks", "Weeks"], ["months", "Months"], ["years", "Years"]] as const;
export type RevenueSelection = { view: (typeof revenueViews)[number][0]; year: number; month: number };
export type RevenuePoint = { label: string; value: number | null; tooltipLabel?: string; unavailableLabel?: string };
const dayMs = 86400000;
const iso = (time: number) => new Date(time).toISOString().slice(0, 10);
const monthName = (year: number, month: number) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long" }).format(new Date(Date.UTC(year, month - 1, 1)));
const dateName = (day: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Johannesburg", dateStyle: "medium" }).format(new Date(`${day}T12:00:00+02:00`));

export function isoWeekYear(day: string) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  return date.getUTCFullYear();
}
export function availableRevenueYears(historyStart: string | null, now: Date, view: RevenueSelection["view"] = "months") {
  const current = view === "weeks" ? isoWeekYear(localDay(now)) : Number(localDay(now).slice(0, 4));
  const first = historyStart ? (view === "weeks" ? isoWeekYear(historyStart) : Number(historyStart.slice(0, 4))) : current;
  return Array.from({ length: current - first + 1 }, (_, i) => first + i);
}
export function defaultRevenueSelection(now: Date): RevenueSelection {
  const today = localDay(now);
  return { view: "months", year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
}
export function currentRevenueSelection(view: RevenueSelection["view"], now: Date): RevenueSelection {
  const current = defaultRevenueSelection(now);
  return { ...current, view, year: view === "weeks" ? isoWeekYear(localDay(now)) : current.year };
}
export function validateRevenueSelection(input: RevenueSelection, historyStart: string | null, now: Date) {
  if (!input || !revenueViews.some(([view]) => view === input.view) || !Number.isInteger(input.year) || !availableRevenueYears(historyStart, now, input.view).includes(input.year) || !Number.isInteger(input.month) || input.month < 1 || input.month > 12)
    throw new Error("Choose an available reporting year and a valid month.");
  if (input.view === "days" && `${input.year}-${String(input.month).padStart(2, "0")}` > localDay(now).slice(0, 7))
    throw new Error("Choose a month that has already started.");
  return input;
}
function isoYearStart(year: number) {
  const jan4 = Date.UTC(year, 0, 4);
  const weekday = new Date(jan4).getUTCDay() || 7;
  return jan4 - (weekday - 1) * dayMs;
}
export function revenueBuckets(selection: RevenueSelection, historyStart: string | null, now: Date) {
  validateRevenueSelection(selection, historyStart, now);
  const { view, year, month } = selection;
  if (!historyStart) return [];
  const today = localDay(now);
  const withinHistory = (bucket: { from: string; to: string }) => bucket.to >= historyStart && bucket.from <= today;
  if (view === "days") return Array.from({ length: new Date(Date.UTC(year, month, 0)).getUTCDate() }, (_, i) => {
    const from = iso(Date.UTC(year, month - 1, i + 1));
    return { label: `Day ${i + 1}`, from, to: from };
  }).filter(withinHistory);
  if (view === "weeks") {
    const start = isoYearStart(year), end = isoYearStart(year + 1);
    return Array.from({ length: (end - start) / (7 * dayMs) }, (_, i) => ({ label: `Week ${i + 1}`, from: iso(start + i * 7 * dayMs), to: iso(start + (i * 7 + 6) * dayMs) })).filter(withinHistory);
  }
  if (view === "months") return Array.from({ length: 12 }, (_, i) => ({ label: monthName(year, i + 1), from: iso(Date.UTC(year, i, 1)), to: iso(Date.UTC(year, i + 1, 0)) })).filter(withinHistory);
  return historyStart ? availableRevenueYears(historyStart, now).map((y) => ({ label: String(y), from: `${y}-01-01`, to: `${y}-12-31` })) : [];
}
export function revenueReportingRange(selection: RevenueSelection, historyStart: string | null, now: Date) {
  const buckets = revenueBuckets(selection, historyStart, now);
  const today = localDay(now);
  return { from: buckets.length ? (buckets[0].from < historyStart! ? historyStart! : buckets[0].from) : today, to: buckets.length ? (buckets[buckets.length - 1].to < today ? buckets[buckets.length - 1].to : today) : today };
}
export function historicalReportingPeriod(input: { from: string; to: string }, historyStart: string | null, now: Date) {
  if (!input?.from || !input?.to) throw new Error("Choose both reporting dates.");
  const period = reportPeriod(input, now, Infinity);
  const year = historyStart ? Number(historyStart.slice(0, 4)) : Number(localDay(now).slice(0, 4));
  const earliest = iso(Math.min(Date.UTC(year, 0, 1), isoYearStart(historyStart ? isoWeekYear(historyStart) : isoWeekYear(localDay(now)))));
  if (period.from < earliest || period.to > localDay(now)) throw new Error("Choose dates within the available sales history, through today.");
  return period;
}
export function aggregateRevenuePeriods(daily: FranchiseDailyTotal[], selection: RevenueSelection, historyStart: string | null, now: Date): RevenuePoint[] {
  const today = localDay(now);
  const byDay = new Map<string, number>();
  for (const row of daily) if (historyStart && row.day >= historyStart && row.day <= today) byDay.set(row.day, (byDay.get(row.day) || 0) + Math.round(Number(row.revenue) * 100));
  return revenueBuckets(selection, historyStart, now).map((bucket) => {
    const from = bucket.from < historyStart! ? historyStart! : bucket.from;
    const to = bucket.to > today ? today : bucket.to;
    let cents = 0;
    for (const [day, value] of byDay) if (day >= from && day <= to) cents += value;
    return { label: bucket.label, value: cents / 100,
      tooltipLabel: `${bucket.label}: ${dateName(from)}${to === from ? "" : ` \u2013 ${dateName(to)}`}${bucket.to >= today ? " (in progress)" : ""}` };
  });
}
export function revenueReportingTitle(selection: RevenueSelection) {
  return selection.view === "days" ? `Daily Revenue — ${monthName(selection.year, selection.month)} ${selection.year}`
    : selection.view === "weeks" ? `Weekly Revenue — ${selection.year}` : selection.view === "months" ? `Monthly Revenue — ${selection.year}` : "Annual Revenue — All Available Years";
}
