export const plotTop = 48;
export const plotBottom = 150;
export const axisWidth = 84;

export const chartMoney = new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" });
const axisMoney = new Intl.NumberFormat("en-ZA", {
  style: "currency", currency: "ZAR", notation: "compact",
  minimumFractionDigits: 0, maximumFractionDigits: 2,
});
export const axisRevenueLabel = (value: number) => axisMoney.format(value);

// Four equal, rounded intervals, including a useful zero-sales scale.
export function revenueScale(values: number[]) {
  const peak = Math.max(0, ...values);
  const rough = (peak || 1) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const multiple = [1, 2, 2.5, 5, 10].find((n) => n * magnitude >= rough)!;
  const step = Math.max(.01, multiple * magnitude);
  const max = step * 4;
  const ticks = Array.from({ length: 5 }, (_, i) => Number((step * i).toPrecision(12)));
  return { max, ticks, y: (value: number) => plotBottom - (value / max) * (plotBottom - plotTop) };
}

type ChartPeriod = { preset: string; from: string; to: string };
const dateFormat = new Intl.DateTimeFormat("en-ZA", { timeZone: "UTC", day: "numeric", month: "short" });
const monthFormat = new Intl.DateTimeFormat("en-ZA", { timeZone: "UTC", month: "short", year: "numeric" });

export function revenueDateTicks(labels: string[], period?: ChartPeriod) {
  const span = labels.length;
  const monthly = period?.preset === "year" || span > 90;
  const weekly = !monthly && span > 31;
  const ticks = labels.flatMap((label, i) => {
    const date = new Date(`${label}T12:00:00Z`);
    if (i !== 0 && (monthly ? label.slice(8) !== "01" : weekly ? date.getUTCDay() !== 1 : false)) return [];
    return [{ index: i, label: monthly ? monthFormat.format(date) : `${weekly ? "Week of " : ""}${dateFormat.format(date)}` }];
  });
  return { title: monthly ? "Month / year" : weekly ? "Week" : "Date", ticks };
}
