import { currentCalendarKpiBounds } from "@/lib/manager/report-calendar";
import { localDay, reportPeriod, type FranchiseDailyTotal } from "./reporting";
import { historicalReportingPeriod } from "./revenue-reporting";

export const overviewPresets = [
  ["today", "Today"],
  ["week", "This Week"],
  ["month", "This Month"],
  ["year", "This Year"],
  ["custom", "Custom Date Range"],
] as const;
export type OverviewPreset = (typeof overviewPresets)[number][0];
export type OverviewPeriod = {
  preset: OverviewPreset;
  from: string;
  to: string;
};
export type DailySnapshot = {
  from: string;
  to: string;
  daily: FranchiseDailyTotal[];
};

export function overviewPeriod(
  preset: OverviewPreset,
  input: { from?: string; to?: string },
  now: Date,
  historyStart?: string | null,
): OverviewPeriod {
  const today = localDay(now);
  if (preset === "custom" && (!input.from || !input.to))
    throw new Error("Choose both dates.");
  const from =
    preset === "today"
      ? today
      : preset === "week"
        ? localDay(currentCalendarKpiBounds(now).week.start)
        : preset === "month"
          ? `${today.slice(0, 7)}-01`
          : preset === "year"
            ? `${today.slice(0, 4)}-01-01`
            : input.from;
  const bounds = { from: from!, to: preset === "custom" ? input.to! : today };
  const period = historyStart !== undefined && preset === "custom" ? historicalReportingPeriod(bounds, historyStart, now) : reportPeriod(
    { from, to: preset === "custom" ? input.to : today },
    now,
  );
  return { preset, from: period.from, to: period.to };
}
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Johannesburg",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const monthFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Johannesburg",
  month: "long",
  year: "numeric",
});
export function overviewPeriodLabel(period: OverviewPeriod) {
  const from = new Date(`${period.from}T12:00:00+02:00`),
    to = new Date(`${period.to}T12:00:00+02:00`);
  const dates =
    period.from === period.to
      ? dateFormatter.format(from)
      : `${dateFormatter.format(from)} – ${dateFormatter.format(to)}`;
  const name = overviewPresets.find(([value]) => value === period.preset)![1];
  return `Showing: ${name} — ${period.preset === "month" ? monthFormatter.format(from) : period.preset === "year" ? period.from.slice(0, 4) : dates}`;
}
export function periodStoreTotals(
  daily: FranchiseDailyTotal[],
  period: { from: string; to: string },
) {
  const totals = new Map<string, { revenue: number; transactions: number }>();
  for (const row of daily) {
    if (row.day < period.from || row.day > period.to) continue;
    const old = totals.get(row.store_id) || { revenue: 0, transactions: 0 };
    old.revenue += Math.round(Number(row.revenue) * 100);
    old.transactions += Number(row.transactions);
    totals.set(row.store_id, old);
  }
  return new Map(
    [...totals].map(([id, value]) => [
      id,
      { ...value, revenue: value.revenue / 100 },
    ]),
  );
}
export function periodRevenueTrend(
  daily: FranchiseDailyTotal[],
  period: OverviewPeriod,
) {
  const byDay = new Map<string, number>();
  for (const row of daily)
    if (row.day >= period.from && row.day <= period.to)
      byDay.set(
        row.day,
        (byDay.get(row.day) || 0) + Math.round(Number(row.revenue) * 100),
      );
  const trend: { label: string; value: number }[] = [];
  for (
    let day = Date.parse(`${period.from}T00:00:00Z`);
    day <= Date.parse(`${period.to}T00:00:00Z`);
    day += 86400000
  ) {
    const label = new Date(day).toISOString().slice(0, 10);
    trend.push({ label, value: (byDay.get(label) || 0) / 100 });
  }
  return trend;
}

// This cache belongs to one mounted, authenticated overview, not a global user cache.
// Presets use the initial snapshot. Historical custom ranges are bounded and deduplicated.
export function createOverviewRangeLoader<
  T extends { from: string; to: string },
>(
  initial: T,
  fetchRange: (period: { from: string; to: string }) => Promise<T>,
  exact = false,
) {
  const snapshots = [{ snapshot: initial, expires: Date.now() + 15_000 }];
  const pending = new Map<string, Promise<T>>();
  return (period: { from: string; to: string }) => {
    for (let i = snapshots.length - 1; i >= 0; i--)
      if (snapshots[i].expires <= Date.now()) snapshots.splice(i, 1);
    const hit = snapshots.find(({ snapshot: s }) =>
      exact
        ? s.from === period.from && s.to === period.to
        : s.from <= period.from && s.to >= period.to,
    );
    if (hit) return Promise.resolve(hit.snapshot);
    const key = JSON.stringify([period.from, period.to]);
    const inFlight = pending.get(key);
    if (inFlight) return inFlight;
    const promise = Promise.resolve()
      .then(() => fetchRange({ from: period.from, to: period.to }))
      .then((snapshot) => {
        if (snapshot.from > period.from || snapshot.to < period.to)
          throw Error("Incomplete reporting period.");
        snapshots.push({ snapshot, expires: Date.now() + 15_000 });
        if (snapshots.length > 8) snapshots.shift();
        return snapshot;
      })
      .finally(() => pending.delete(key));
    pending.set(key, promise);
    return promise;
  };
}
