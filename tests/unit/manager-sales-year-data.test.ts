import { afterEach, expect, it, vi } from "vitest";
import type { DashboardSession } from "@/lib/dashboard-session";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ queries: [] as { store: string; status: string; start: string; end: string; offset: number; orders: string[] }[] }));
vi.mock("@/lib/logger", () => ({ logServerEvent: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({
  from(table: string) {
    const query = { store: "", status: "", start: "", end: "", offset: 0, orders: [] as string[] };
    const builder = {
      select() { return builder; },
      eq(key: string, value: string) { if (key === "store_id") query.store = value; if (key === "status") query.status = value; return builder; },
      gte(_key: string, value: string) { query.start = value; return builder; },
      lt(_key: string, value: string) { query.end = value; return builder; },
      order(key: string) { query.orders.push(key); return builder; },
      in() { return Promise.resolve({ data: [], error: null }); },
      async range(start: number, end: number) {
        expect(table).toBe("pos_sales");
        state.queries.push({ ...query, orders: [...query.orders], offset: start });
        const row = (id: string, date: string, total = 10, refund = 2, store = "store-a", status = "completed") => ({ id, created_at: date, total, refunded_amount: refund, store_id: store, status, checkout_id: null, customer_id: null, staff_user_id: null });
        const rows = [
          ...Array.from({ length: 401 }, (_, index) => row(`sale-${index}`, "2026-06-15T10:00:00Z")),
          row("year-start", "2025-12-31T22:00:00Z", 100, 20),
          row("year-end", "2026-12-31T21:59:59.999Z", 200, 0),
          row("too-early", "2025-12-31T21:59:59.999Z", 99999, 0),
          row("too-late", "2026-12-31T22:00:00Z", 99999, 0),
          row("other-store", "2026-06-15T10:00:00Z", 99999, 0, "store-b"),
          row("voided", "2026-06-15T10:00:00Z", 99999, 0, "store-a", "voided")
        ].filter((sale) => sale.store_id === query.store && sale.status === query.status && sale.created_at >= query.start && sale.created_at < query.end);
        const batch = rows.slice(start, end + 1);
        // An overlapping last page must never count a sale twice.
        if (start === 400) batch.push(rows[0]);
        return { data: batch, error: null };
      }
    };
    return builder;
  }
}) }));

import { getManagerSalesReport } from "@/lib/manager/sales-overview";
afterEach(() => { vi.useRealTimers(); state.queries.length = 0; });

it("loads the full current calendar year for the assigned store, paginates and deducts refunds once", async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-16T10:00:00Z"));
  const report = await getManagerSalesReport({ assignedStoreId: "store-a" } as DashboardSession, { month: "2025-09", search: "unmatched", category: "Flower" });
  expect(report.kpis).toMatchObject({ revenueThisYear: 3488, currentYearLabel: "2026", revenueThisWeek: 0, revenueThisMonth: 0 });
  expect(report.summary.revenue).toBe(0);
  const yearly = state.queries.filter((query) => query.start === "2025-12-31T22:00:00.000Z" && query.end === "2026-12-31T22:00:00.000Z");
  expect(yearly.map((query) => query.offset)).toEqual([0, 200, 400]);
  expect(yearly.every((query) => query.store === "store-a" && query.status === "completed" && query.orders.includes("id"))).toBe(true);
});
