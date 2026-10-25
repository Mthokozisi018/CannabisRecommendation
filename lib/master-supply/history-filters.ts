import { johannesburgDay, requestPeriodBounds } from "./request-filters";
import type { SupplyDistribution, SupplySnapshot } from "./data";

export type HistoryPeriod = "all_time" | "today" | "this_week" | "this_month" | "this_year" | "custom";
export type HistoryFilters = { search: string; storeId: string; status: string; period: HistoryPeriod; from: string; to: string };

function validDay(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function distributionTimestamp(distribution: SupplyDistribution) {
  return distribution.dispatched_at ?? distribution.created_at;
}

export function historyDateBounds(filters: Pick<HistoryFilters, "period" | "from" | "to">, now = new Date()) {
  if (filters.period === "all_time") return null;
  if (filters.period === "custom") {
    if (!filters.from && !filters.to) return null;
    if (!validDay(filters.from) || !validDay(filters.to) || filters.from > filters.to) throw new Error("Choose a valid start and end date.");
    return { start: filters.from, end: filters.to, inclusiveEnd: true };
  }
  const bounds = requestPeriodBounds(filters.period, now)!;
  return { ...bounds, inclusiveEnd: false };
}

export function filterSupplyHistory(snapshot: SupplySnapshot, filters: HistoryFilters, now = new Date()) {
  const stores = new Map(snapshot.stores.map(store => [store.id, store]));
  const products = new Map(snapshot.products.map(product => [product.id, product]));
  const bounds = historyDateBounds(filters, now);
  const search = filters.search.trim().toLocaleLowerCase();
  return snapshot.distributions.filter(distribution => {
    const store = stores.get(distribution.store_id);
    const date = bounds ? johannesburgDay(distributionTimestamp(distribution)) : "";
    const names = distribution.master_supply_distribution_items.map(item => products.get(item.product_id)?.name ?? "").join(" ");
    const searchable = `${store?.name ?? ""} ${store?.city ?? ""} ${store?.province ?? ""} ${names}`.toLocaleLowerCase();
    return (!filters.storeId || distribution.store_id === filters.storeId) &&
      (!filters.status || distribution.status === filters.status) &&
      (!bounds || (date >= bounds.start && (bounds.inclusiveEnd ? date <= bounds.end : date < bounds.end))) &&
      (!search || searchable.includes(search));
  });
}
