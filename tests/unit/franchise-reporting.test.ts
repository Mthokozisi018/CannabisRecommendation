import { describe, expect, it } from "vitest";
import {
  decideAccountAccess,
  franchiseLoginDestination,
} from "@/lib/account-flow";
import { normalizeRole, roleHasPermission } from "@/lib/authorization";
import {
  localDay,
  reportPeriod,
  summarizeFranchiseSales,
  summarizeDailyTotals,
  summarizeSaleItems,
  type FranchiseSale,
} from "@/lib/franchise/reporting";
import { inventoryStockLevel } from "@/lib/manager/stock-level";
describe("Franchise authorization and reporting", () => {
  it("keeps the role distinct and requires a trusted franchise assignment", () => {
    expect(normalizeRole("franchise_admin")).toBe("franchise_admin");
    expect(roleHasPermission("franchise_admin", "platform.admin")).toBe(false);
    expect(
      decideAccountAccess({
        role: "franchise_admin",
        is_active: true,
        account_status: "active",
      }).allowed,
    ).toBe(false);
    expect(
      decideAccountAccess({
        role: "franchise_admin",
        franchise_id: "assigned",
        is_active: true,
        account_status: "active",
      }).allowed,
    ).toBe(true);
    expect(franchiseLoginDestination({ accountSetupComplete: false })).toBe(
      "/franchise/setup",
    );
    expect(franchiseLoginDestination({ accountSetupComplete: true })).toBe(
      "/dashboard/franchise",
    );
  });
  it("uses Johannesburg day boundaries, inclusive end dates, and validates dates", () => {
    expect(localDay("2026-10-09T22:00:00Z")).toBe("2026-10-10");
    const p = reportPeriod({ from: "2026-10-10", to: "2026-10-10" });
    expect(p.start.toISOString()).toBe("2026-10-09T22:00:00.000Z");
    expect(p.end.toISOString()).toBe("2026-10-10T22:00:00.000Z");
    expect(() =>
      reportPeriod({ from: "2026-02-30", to: "2026-03-01" }),
    ).toThrow();
    expect(() =>
      reportPeriod({ from: "2026-10-10", to: "2026-10-01" }),
    ).toThrow();
  });
  it("aggregates actual totals and zero-fills days without fabricated transactions", () => {
    const sale = (created_at: string, total: number): FranchiseSale => ({
      id: created_at,
      store_id: "one",
      customer_id: null,
      staff_user_id: null,
      checkout_id: null,
      payment_method: "cash",
      created_at,
      total,
    });
    const rows = [
      sale("2026-10-09T22:00:00.000Z", 0.1),
      sale("2026-10-10T10:00:00.000Z", 0.2),
      sale("2026-09-01T12:00:00.000Z", 50),
    ];
    const result = summarizeFranchiseSales(
      rows,
      reportPeriod({ from: "2026-10-10", to: "2026-10-11" }),
      new Date("2026-10-10T12:00:00Z"),
    );
    expect(result.revenue).toBe(0.3);
    expect(result.year).toBe(50.3);
    expect(result.trend).toEqual([
      { label: "2026-10-10", value: 0.3 },
      { label: "2026-10-11", value: 0 },
    ]);
    expect(summarizeFranchiseSales([], reportPeriod({})).revenue).toBe(0);
  });
  it("derives categories from recorded sale items and shares the manager low-stock rule", () => {
    expect(
      summarizeSaleItems([
        {
          sale_id: "s",
          product_name_snapshot: "Real product",
          category_snapshot: "Actual category",
          subcategory_snapshot: null,
          quantity: 2,
          unit_price: 5,
          line_total: 10,
        },
      ]).categories,
    ).toEqual([{ label: "Actual category", value: 10 }]);
    expect(inventoryStockLevel(0, 0)).toBe("out_of_stock");
    expect(inventoryStockLevel(4, 5)).toBe("low_stock");
    expect(inventoryStockLevel(4, 0)).toBe("in_stock");
  });
});

it("daily aggregates preserve calendar revenue, zero-filled days and actual transaction counts", () => {
  const now = new Date("2026-10-13T12:00:00+02:00");
  const period = reportPeriod({ from: "2026-10-01", to: "2026-10-13" }, now);
  const rows = [
    { store_id: "a", day: "2026-09-30", revenue: "90.00", transactions: "2" },
    { store_id: "a", day: "2026-10-12", revenue: "123.45", transactions: "8" },
    { store_id: "b", day: "2026-10-12", revenue: "0.30", transactions: "3" },
  ];
  const result = summarizeDailyTotals(rows, period, now);
  expect(result.transactionCount).toBe(11);
  expect(result.revenue).toBe(123.75);
  expect(result.month).toBe(123.75);
  expect(result.year).toBe(213.75);
  expect(result.week).toBe(123.75);
  expect(result.trend).toHaveLength(13);
  expect(result.trend[0].value).toBe(0);
  expect(result.trend[11].value).toBe(123.75);
});
