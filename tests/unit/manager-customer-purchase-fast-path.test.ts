import { expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ report: vi.fn(), tables: [] as string[] }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/manager/sales-overview", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/manager/sales-overview")>(),
  getManagerSalesReport: state.report
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from: (table: string) => {
      state.tables.push(table);
      const query = {
        select: () => query,
        eq: () => query,
        not: () => query,
        gte: () => query,
        lt: () => query,
        order: () => query,
        is: async () => ({ data: [
          { id: "customer-a", first_name: "Thabo", surname: "Mokoena", full_name: "Thabo Mokoena", phone_display: "072 123 4567", phone_normalized: "+27721234567" }
        ], error: null }),
        range: async () => ({ data: [
          { id: "sale-a", customer_id: "customer-a", total: 120, refunded_amount: 20, created_at: "2026-10-21T10:00:00Z" },
          { id: "sale-b", customer_id: "customer-a", total: 40, refunded_amount: 40, created_at: "2026-10-21T11:00:00Z" }
        ], error: null }),
        in: () => query
      };
      return query;
    }
  })
}));

import { getManagerCustomerPurchaseOverview } from "@/lib/manager/customer-purchase-overview";
import type { DashboardSession } from "@/lib/dashboard-session";

it("loads customer totals without fetching sale items or staff for an unfiltered report", async () => {
  state.tables.length = 0;
  state.report.mockClear();
  const overview = await getManagerCustomerPurchaseOverview({ assignedStoreId: "store-a" } as DashboardSession, {
    filters: { month: "2026-10", week: "all", search: "", receptionist: "all", category: "all", page: 1 },
    search: "", sort: "purchases_desc", page: 1
  });
  expect(state.tables).toEqual(["pos_sales", "pos_customers"]);
  expect(state.report).not.toHaveBeenCalled();
  expect(overview.rows).toMatchObject([{ customerId: "customer-a", timesPurchased: 1, totalSpent: 100 }]);
});
