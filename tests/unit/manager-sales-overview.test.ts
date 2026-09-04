import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildManagerSalesReport, currentCalendarKpiBounds, getMonthWeeks, monthBounds, parseSalesReportFilters, type SalesReportSource } from "@/lib/manager/sales-overview";
import { buildManagerSalesReportPdf } from "@/lib/manager/sales-report-pdf";

const filters = parseSalesReportFilters({ month: "2026-09" }, new Date("2026-09-15T10:00:00Z"));
const source: SalesReportSource = {
  sales: [
    { id: "sale-a", checkout_id: "RCPT-100", customer_id: "customer-a", staff_user_id: "staff-a", total: 125, created_at: "2026-09-01T08:00:00Z" },
    { id: "sale-b", checkout_id: "RCPT-101", customer_id: "customer-a", staff_user_id: "staff-a", total: 50, created_at: "2026-09-01T08:00:00Z" },
    { id: "sale-c", checkout_id: null, customer_id: null, staff_user_id: "former-staff", total: 20, created_at: "2026-09-08T08:00:00Z" }
  ],
  items: [
    { sale_id: "sale-a", product_name_snapshot: "Blue Dream", category_snapshot: "Flower", subcategory_snapshot: "Sativa", unit_price: 50, quantity: 2, line_total: 100 },
    { sale_id: "sale-a", product_name_snapshot: "Gummies", category_snapshot: "Edibles", subcategory_snapshot: "Gummies", unit_price: 25, quantity: 1, line_total: 25 },
    { sale_id: "sale-b", product_name_snapshot: "Blue Dream", category_snapshot: "Flower", subcategory_snapshot: "Sativa", unit_price: 50, quantity: 1, line_total: 50 },
    { sale_id: "sale-c", product_name_snapshot: "Archive item", category_snapshot: null, subcategory_snapshot: null, unit_price: 10, quantity: 1, line_total: 10 }
  ],
  customers: [{ id: "customer-a", first_name: "Anele", surname: "Dube", full_name: "Anele Dube", phone_display: null, phone_normalized: null }],
  staff: [{ auth_user_id: "staff-a", user_id: null, full_name: "Lerato M", first_name: null, surname: null, email: null }]
};

describe("Manager Sales Overview reporting", () => {
  it("keeps products together and never merges distinct sales sharing customer and time", () => {
    const report = buildManagerSalesReport(source, filters);
    expect(report.transactions).toHaveLength(3);
    expect(report.transactions[0]).toMatchObject({ saleId: "sale-a", itemCount: 3, itemSubtotal: 125, recordedTotal: 125 });
    expect(report.transactions[0].items).toHaveLength(2);
    expect(report.summary).toEqual({ uniqueCustomers: 1, revenue: 195, transactionCount: 3 });
  });

  it("starts analytics from the first completed transaction without waiting for a full week", () => {
    const firstSaleSource: SalesReportSource = {
      sales: [{ id: "first-sale", checkout_id: "RCPT-FIRST", customer_id: "customer-a", staff_user_id: "staff-a", total: 250, created_at: "2026-09-01T08:00:00Z" }],
      items: [{ sale_id: "first-sale", product_name_snapshot: "Blue Dream", category_snapshot: "Flower", subcategory_snapshot: "Sativa", unit_price: 250, quantity: 1, line_total: 250 }],
      customers: source.customers,
      staff: source.staff
    };
    const report = buildManagerSalesReport(firstSaleSource, filters, false, {
      weekSales: firstSaleSource.sales,
      monthSales: firstSaleSource.sales,
      currentWeekLabel: "31 Aug 2026 - 06 Sept 2026",
      currentMonthLabel: "September 2026"
    });
    expect(report.summary).toEqual({ uniqueCustomers: 1, revenue: 250, transactionCount: 1 });
    expect(report.kpis.revenueThisWeek).toBe(250);
    expect(report.kpis.revenueThisMonth).toBe(250);
    expect(report.transactions).toHaveLength(1);
  });

  it("supports Johannesburg bounds, partial calendar weeks, leap February, and six-week months", () => {
    expect(monthBounds("2026-09").start.toISOString()).toBe("2026-08-31T22:00:00.000Z");
    expect(monthBounds("2026-09").end.toISOString()).toBe("2026-09-30T22:00:00.000Z");
    expect(getMonthWeeks("2026-09")[0]).toMatchObject({ startDate: "2026-09-01", endDate: "2026-09-06" });
    expect(getMonthWeeks("2024-02").at(-1)).toMatchObject({ endDate: "2024-02-29" });
    expect(getMonthWeeks("2026-03")).toHaveLength(6);
  });

  it("uses full Johannesburg Monday-to-Sunday and calendar-month KPI boundaries", () => {
    const bounds = currentCalendarKpiBounds(new Date("2026-09-03T20:30:00Z"));
    expect(bounds.week.start.toISOString()).toBe("2026-08-30T22:00:00.000Z");
    expect(bounds.week.end.toISOString()).toBe("2026-09-06T22:00:00.000Z");
    expect(bounds.month.start.toISOString()).toBe("2026-08-31T22:00:00.000Z");
    expect(bounds.month.end.toISOString()).toBe("2026-09-30T22:00:00.000Z");
    expect(bounds.currentWeekLabel).toBe("31 Aug 2026 - 06 Sept 2026");
    expect(bounds.currentMonthLabel).toBe("September 2026");
  });

  it("applies week, product search, receptionist, and category before KPIs", () => {
    const report = buildManagerSalesReport(source, { ...filters, week: "2026-09-01", search: "blue dream", receptionist: "Lerato M", category: "Flower", page: 1 });
    expect(report.transactions.map((transaction) => transaction.saleId)).toEqual(["sale-a", "sale-b"]);
    expect(report.summary).toEqual({ uniqueCustomers: 1, revenue: 175, transactionCount: 2 });
  });

  it("uses fallbacks and flags reconciliation without changing the recorded total", () => {
    const transaction = buildManagerSalesReport(source, { ...filters, search: "archive" }).transactions[0];
    expect(transaction).toMatchObject({ customerName: "Walk-in / historical sale", customerPhone: "No cellphone on record", receptionistName: "Former staff member", itemSubtotal: 10, recordedTotal: 20, needsReconciliation: true });
  });

  it("keeps current week and month revenue independent from selected report filters", () => {
    const report = buildManagerSalesReport(source, { ...filters, search: "archive" }, false, {
      weekSales: source.sales.slice(0, 2),
      monthSales: source.sales,
      currentWeekLabel: "31 Aug 2026 - 06 Sept 2026",
      currentMonthLabel: "September 2026"
    });
    expect(report.summary).toEqual({ uniqueCustomers: 0, revenue: 20, transactionCount: 1 });
    expect(report.kpis).toEqual({ revenueThisWeek: 175, revenueThisMonth: 195, currentWeekLabel: "31 Aug 2026 - 06 Sept 2026", currentMonthLabel: "September 2026" });
  });

  it("rejects extra client fields such as a store ID", () => {
    expect(() => parseSalesReportFilters({ month: "2026-09", storeId: "other-store" })).toThrow();
  });

  it("creates an A4 PDF containing filtered summaries, transactions, and items", () => {
    const report = buildManagerSalesReport(source, filters, true);
    const pdf = buildManagerSalesReportPdf({ report, storeName: "Admin Demo Store", generatedAt: new Date("2026-09-15T10:00:00Z") });
    const text = pdf.toString("latin1");
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("Admin Demo Store - Sales Overview");
    expect(text).toContain("RCPT-100");
    expect(text).toContain("Blue Dream");
    expect(text).toContain("Revenue: R 195,00");
  });
});
