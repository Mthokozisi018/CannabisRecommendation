import { netSaleCents } from "@/lib/sales-money";
import { z } from "zod";
import {
  currentCalendarKpiBounds,
  datePartsInTimeZone,
  monthBounds,
  pad,
} from "@/lib/manager/report-calendar";
export type FranchiseSale = {
  id: string;
  store_id: string;
  customer_id: string | null;
  staff_user_id: string | null;
  checkout_id: string | null;
  total: number | string;
  refunded_amount?: number | string;
  payment_method: string | null;
  created_at: string;
};
export type FranchiseSaleItem = {
  sale_id: string;
  product_name_snapshot: string | null;
  category_snapshot: string | null;
  subcategory_snapshot: string | null;
  quantity: number | string;
  unit_price: number | string;
  line_total: number | string;
};
export type FranchiseDailyTotal = {
  store_id: string;
  day: string;
  revenue: number | string;
  transactions: number | string;
};
export function summarizeDailyTotals(
  daily: FranchiseDailyTotal[],
  period: ReturnType<typeof reportPeriod>,
  now = new Date(),
) {
  // Reuse the existing calendar and cents-based calculation on daily buckets.
  const summary = summarizeFranchiseSales(
    daily.map((row) => ({
      id: `${row.store_id}:${row.day}`,
      store_id: row.store_id,
      total: row.revenue,
      created_at: `${row.day}T00:00:00+02:00`,
      customer_id: null,
      staff_user_id: null,
      checkout_id: null,
      payment_method: null,
    })),
    period,
    now,
  );
  const selected = daily.filter(
    (row) => row.day >= period.from && row.day <= period.to,
  );
  return {
    ...summary,
    transactionCount: selected.reduce(
      (n, row) => n + Number(row.transactions),
      0,
    ),
  };
}
export function localDay(value: Date | string) {
  const p = datePartsInTimeZone(new Date(value));
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      Number.isFinite(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Invalid reporting date.",
  );
export function reportPeriod(
  input: { from?: string; to?: string },
  now = new Date(),
  maxDays = 366,
) {
  const today = localDay(now);
  const from = date.parse(input.from || `${today.slice(0, 7)}-01`),
    to = date.parse(input.to || today);
  if (from > to || Date.parse(to) - Date.parse(from) > maxDays * 86400000)
    throw new Error("Choose a reporting period of up to one year.");
  return {
    from,
    to,
    start: new Date(`${from}T00:00:00+02:00`),
    end: new Date(Date.parse(`${to}T00:00:00+02:00`) + 86400000),
  };
}
export function summarizeFranchiseSales(
  sales: FranchiseSale[],
  period: ReturnType<typeof reportPeriod>,
  now = new Date(),
) {
  const calendar = currentCalendarKpiBounds(now),
    day = localDay(now);
  const year = monthBounds(`${day.slice(0, 4)}-01`).start;
  const selected = sales.filter(
    (s) =>
      new Date(s.created_at) >= period.start &&
      new Date(s.created_at) < period.end,
  );
  const sum = (rows: FranchiseSale[]) =>
    rows.reduce((total, s) => total + netSaleCents(s), 0) /
    100;
  const within = (start: Date, end: Date) =>
    sales.filter(
      (s) => new Date(s.created_at) >= start && new Date(s.created_at) < end,
    );
  const byDay = new Map<string, number>();
  for (const sale of selected) {
    const day = localDay(sale.created_at);
    byDay.set(
      day,
      (byDay.get(day) || 0) + netSaleCents(sale),
    );
  }
  const trend: { label: string; value: number }[] = [];
  for (
    let t = period.start.getTime();
    t < period.end.getTime();
    t += 86400000
  ) {
    const label = localDay(new Date(t));
    trend.push({ label, value: (byDay.get(label) || 0) / 100 });
  }
  return {
    selected,
    trend,
    revenue: sum(selected),
    year: sum(
      within(
        year,
        new Date(`${Number(day.slice(0, 4)) + 1}-01-01T00:00:00+02:00`),
      ),
    ),
    month: sum(within(calendar.month.start, calendar.month.end)),
    week: sum(within(calendar.week.start, calendar.week.end)),
    today: sum(sales.filter((s) => localDay(s.created_at) === day)),
  };
}
export function summarizeSaleItems(items: FranchiseSaleItem[]) {
  const categories = new Map<string, number>(),
    products = new Map<
      string,
      { key: string; name: string; quantity: number; revenue: number }
    >();
  for (const item of items) {
    const category = item.category_snapshot?.trim() || "Uncategorized",
      name = item.product_name_snapshot?.trim() || "Historical product";
    categories.set(
      category,
      (categories.get(category) || 0) +
        Math.round(Number(item.line_total) * 100),
    );
    const key = `${category}\u0000${name}`,
      old = products.get(key) || { key, name, quantity: 0, revenue: 0 };
    products.set(key, {
      key,
      name,
      quantity: old.quantity + Number(item.quantity),
      revenue: old.revenue + Math.round(Number(item.line_total) * 100),
    });
  }
  return {
    categories: [...categories].map(([label, value]) => ({
      label,
      value: value / 100,
    })),
    products: [...products.values()]
      .map((p) => ({ ...p, revenue: p.revenue / 100 }))
      .sort((a, b) => b.revenue - a.revenue),
  };
}
