import { datePartsInTimeZone, pad } from "@/lib/manager/report-calendar";
import type { SupplyRequest, SupplySnapshot } from "./data";

export type RequestPeriod = "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "last_month" | "this_year" | "all_time";

const key = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`;
const utcDay = (year: number, month: number, day: number) => new Date(Date.UTC(year, month - 1, day));
const dateKey = (date: Date) => key(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());

export function johannesburgDay(value: string | Date) {
  const { year, month, day } = datePartsInTimeZone(typeof value === "string" ? new Date(value) : value);
  return key(year, month, day);
}

export function requestPeriodBounds(period: RequestPeriod, now = new Date()) {
  if (period === "all_time") return null;
  const { year, month, day } = datePartsInTimeZone(now);
  const today = utcDay(year, month, day);
  const offset = (today.getUTCDay() + 6) % 7;
  const weekStart = utcDay(year, month, day - offset);
  const bounds: Record<Exclude<RequestPeriod, "all_time">, [Date, Date]> = {
    today: [today, utcDay(year, month, day + 1)],
    yesterday: [utcDay(year, month, day - 1), today],
    this_week: [weekStart, utcDay(year, month, day - offset + 7)],
    last_week: [utcDay(year, month, day - offset - 7), weekStart],
    this_month: [utcDay(year, month, 1), utcDay(year, month + 1, 1)],
    last_month: [utcDay(year, month - 1, 1), utcDay(year, month, 1)],
    this_year: [utcDay(year, 1, 1), utcDay(year + 1, 1, 1)],
  };
  const [start, end] = bounds[period];
  return { start: dateKey(start), end: dateKey(end) };
}

export function filterSupplyRequests(snapshot: SupplySnapshot, filters: { tab: string; search: string; storeId: string; status: string; period: RequestPeriod }, now = new Date()): SupplyRequest[] {
  const stores = new Map(snapshot.stores.map(store => [store.id, store]));
  const products = new Map(snapshot.products.map(product => [product.id, product]));
  const bounds = requestPeriodBounds(filters.period, now);
  const search = filters.search.trim().toLocaleLowerCase();
  return snapshot.requests.filter(request => {
    const tabMatch = filters.tab === "all" || request.status === filters.tab ||
      (filters.tab === "approved" && request.status === "partially_approved") ||
      (filters.tab === "fulfilled" && request.status === "partially_fulfilled");
    const date = bounds ? johannesburgDay(request.created_at) : "";
    const searchable = `${request.id} ${stores.get(request.store_id)?.name ?? ""} ${request.master_supply_request_items.map(item => products.get(item.product_id)?.name ?? "").join(" ")}`.toLocaleLowerCase();
    return tabMatch && (!filters.status || request.status === filters.status) &&
      (!filters.storeId || request.store_id === filters.storeId) &&
      (!bounds || (date >= bounds.start && date < bounds.end)) &&
      (!search || searchable.includes(search));
  });
}
