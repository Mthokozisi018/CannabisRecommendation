import { expect, it, vi } from "vitest";
import type { SupplySnapshot, SupplyStore } from "@/lib/master-supply/data";
import { createSupplyDemoSnapshot } from "@/lib/master-supply/demo-data";
import { distributionTimestamp, filterSupplyHistory, historyDateBounds, type HistoryFilters } from "@/lib/master-supply/history-filters";

vi.mock("server-only", () => ({}));

const stores: SupplyStore[] = [
  { id: "00000000-0000-4000-8000-000000000001", name: "Pretoria East", city: "Pretoria", province: "Gauteng", store_image_url: null, is_active: true, store_access_status: "active" },
  { id: "00000000-0000-4000-8000-000000000002", name: "Centurion", city: "Centurion", province: "Gauteng", store_image_url: null, is_active: true, store_access_status: "active" },
];
const now = new Date("2026-10-20T22:30:00Z");
const defaults: HistoryFilters = { search: "", storeId: "", status: "", period: "all_time", from: "", to: "" };

function datedSnapshot() {
  const snapshot: SupplySnapshot = createSupplyDemoSnapshot("franchise", "actor", stores, now);
  const stamps = ["2026-10-20T22:15:00Z", "2026-10-19T10:00:00Z", "2026-10-10T10:00:00Z", "2026-02-10T10:00:00Z"];
  snapshot.distributions.forEach((row, index) => { row.dispatched_at = stamps[index]; row.created_at = "2025-01-01T10:00:00Z"; });
  return snapshot;
}

it("uses the real dispatch timestamp and Johannesburg preset boundaries", () => {
  const snapshot = datedSnapshot();
  expect(distributionTimestamp(snapshot.distributions[0])).toBe("2026-10-20T22:15:00Z");
  expect(filterSupplyHistory(snapshot, { ...defaults, period: "today" }, now)).toHaveLength(1);
  expect(filterSupplyHistory(snapshot, { ...defaults, period: "this_week" }, now)).toHaveLength(2);
  expect(filterSupplyHistory(snapshot, { ...defaults, period: "this_month" }, now)).toHaveLength(3);
  expect(filterSupplyHistory(snapshot, { ...defaults, period: "this_year" }, now)).toHaveLength(4);
  expect(historyDateBounds({ period: "this_week", from: "", to: "" }, now)).toEqual({ start: "2026-10-19", end: "2026-10-26", inclusiveEnd: false });
});

it("applies custom range, search, store and status together", () => {
  const snapshot = datedSnapshot();
  const row = snapshot.distributions[0];
  const product = snapshot.products.find(item => item.id === row.master_supply_distribution_items[0].product_id)!;
  const filters: HistoryFilters = { search: product.name, storeId: row.store_id, status: row.status, period: "custom", from: "2026-10-21", to: "2026-10-21" };
  expect(filterSupplyHistory(snapshot, filters, now).map(item => item.id)).toEqual([row.id]);
  expect(filterSupplyHistory(snapshot, { ...filters, storeId: stores.find(store => store.id !== row.store_id)!.id }, now)).toEqual([]);
  expect(filterSupplyHistory(snapshot, { ...filters, status: "cancelled" }, now)).toEqual([]);
  expect(() => historyDateBounds({ period: "custom", from: "2026-10-22", to: "2026-10-21" })).toThrow();
  expect(() => historyDateBounds({ period: "custom", from: "2026-02-30", to: "2026-10-21" })).toThrow();
});

it("preserves direct and request-backed distributions and their own item quantities", () => {
  const snapshot = datedSnapshot();
  const rows = filterSupplyHistory(snapshot, defaults, now);
  expect(rows.some(row => row.request_id === null)).toBe(true);
  const linked = rows.find(row => row.request_id !== null)!;
  expect(snapshot.requests.find(request => request.id === linked.request_id)?.store_id).toBe(linked.store_id);
  expect(linked.master_supply_distribution_items.reduce((sum, item) => sum + item.quantity, 0)).toBeGreaterThan(0);
});
