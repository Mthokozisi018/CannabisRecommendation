import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/dashboard/manager/suppliers/actions", () => ({ archiveSupplierAction: vi.fn(), saveSupplierAction: vi.fn(), refreshManagerSupplyReport: vi.fn(), loadManagerSupplierProfile: vi.fn() }));
import { SupplierManagement } from "@/components/manager/SupplierManagement";
import { buildSupplyReport, parseSupplyFilters } from "@/lib/manager/supply-report";
import { getMonthWeeks } from "@/lib/manager/sales-overview";
import { supplySource, delivery, line } from "@/tests/fixtures/supply-report";

describe("transaction supply history", () => {
  it("counts product IDs once across filtered transactions, independent of quantities, names and categories", () => {
    const source = { ...supplySource, items: supplySource.items.map(item => ({ ...item, product_id: item.id === "oct-other" ? "product-flower" : item.product_id, product_name_snapshot: "Same product name", quantity: 50 })) };
    const october = buildSupplyReport(source, parseSupplyFilters({ month: "2026-10" }));
    expect(october.summary.uniqueProducts).toBe(2);
    expect(october.summary.transactions).toBe(2);
    expect(october.summary.totalCost).toBe(250);
    expect(october.summary.quantities).toEqual([{ unit: "units", quantity: 150 }]);
    expect(buildSupplyReport(source, parseSupplyFilters({ month: "2026-10", recordedBy: "manager-b" })).summary.uniqueProducts).toBe(1);
    expect(buildSupplyReport(source, parseSupplyFilters({ month: "2026-10", category: "Accessories" })).summary.uniqueProducts).toBe(2);
    expect(buildSupplyReport(source, parseSupplyFilters({ month: "2026-10", search: "oct-2" })).summary.uniqueProducts).toBe(1);
    expect(buildSupplyReport(source, parseSupplyFilters({ month: "2026-10", supplier: "cape" })).summary.uniqueProducts).toBe(0);
    expect(buildSupplyReport(source, parseSupplyFilters({ month: "2026-09", week: "2026-09-07" })).summary.uniqueProducts).toBe(1);
    expect(buildSupplyReport(source, parseSupplyFilters({ month: "2026-11" })).summary.uniqueProducts).toBe(0);
    const markup = renderToStaticMarkup(<SupplierManagement storeName="Test Store" managerName="Manager" initialReport={october} />);
    expect(markup).toContain("Total unique products received.");
    expect(markup).not.toContain("Total quantity; grams and units kept separate");
  });
  it("defaults to the current Johannesburg month and shows each delivery once without grouping levels", () => {
    const filters = parseSupplyFilters({}, new Date("2026-10-08T08:00:00Z"));
    const report = buildSupplyReport(supplySource, filters);
    expect(filters).toMatchObject({ month: "2026-10", week: "all", recordedBy: "all", category: "all", supplier: "all", page: 1 });
    expect(report.transactions.map(transaction => transaction.id)).toEqual(["oct-1", "oct-2"]);
    expect(report.transactions[0].items).toHaveLength(2);
    const markup = renderToStaticMarkup(<SupplierManagement storeName="Test Store" managerName="Manager" initialReport={report} />);
    expect(markup.match(/data-supply-transaction=/g)).toHaveLength(2);
    expect(markup).not.toContain("data-archive-row"); expect(markup).not.toContain("data-supply-row");
    for (const label of ["Month", "Week", "Recorded By", "Category", "Supplier", "Search", "Supply Transactions", "Products Received"]) expect(markup).toContain(label);
    expect(markup).toContain("BudHouse"); expect(markup).toContain("Msizi Test");
  });
  it("matches Sales Overview week conventions, clamps month edges and supports six-week calendars", () => {
    const filters = parseSupplyFilters({ month: "2026-09", week: "2026-09-07" });
    const report = buildSupplyReport(supplySource, filters);
    expect(report.weeks).toEqual(getMonthWeeks("2026-09"));
    expect(report.transactions.map(transaction => transaction.id)).toEqual(["sept-1"]);
    expect(getMonthWeeks("2026-08")).toHaveLength(6);
    expect(() => parseSupplyFilters({ month: "2026-10", week: "2026-09-07" })).toThrow("Invalid supply week");
  });
  it("filters by staff and supplier IDs, preserving full mixed-category transactions and costs", () => {
    const report = buildSupplyReport(supplySource, parseSupplyFilters({ month: "2026-10", category: "Flower", recordedBy: "manager-a", supplier: "budhouse", search: "ACCESSORY" }));
    expect(report.transactions).toHaveLength(1); expect(report.transactions[0].items).toHaveLength(2);
    expect(report.summary).toMatchObject({ transactions: 1, suppliers: 1, quantities: [{ unit: "units", quantity: 15 }], totalCost: 150 });
    expect(report.transactions[0].totalCost).toBe(150);
    expect(report.recorders.filter(person => person.name === "Msizi Test")).toHaveLength(2);
  });
  it("uses recording timestamps instead of delivery timestamps and handles local month/year boundaries", () => {
    const record = { ...delivery("late", "2026-12-31T22:00:00Z"), received_at: "2026-12-01T08:00:00Z" };
    const source = { ...supplySource, deliveries: [record], items: [line("late-line", "late")] };
    const january = buildSupplyReport(source, parseSupplyFilters({ month: "2027-01" }));
    expect(january.transactions[0]).toMatchObject({ dateTime: "01 Jan 2027, 00:00", receivedAt: "2026-12-01T08:00:00Z" });
    expect(buildSupplyReport(source, parseSupplyFilters({ month: "2026-12" })).transactions).toEqual([]);
    expect(parseSupplyFilters({}, new Date("2026-10-31T22:00:00Z")).month).toBe("2026-11");
  });
  it("preserves historical costs and flags reconciliation discrepancies instead of recalculating prices", () => {
    const source = { ...supplySource, deliveries: [delivery("mismatch", "2026-10-08T08:00:00Z", "budhouse", "manager-a", 120)], items: [line("old-price", "mismatch")] };
    const report = buildSupplyReport(source, parseSupplyFilters({ month: "2026-10" }));
    expect(report.transactions[0]).toMatchObject({ totalCost: 120, itemSubtotal: 100, needsReconciliation: true });
    expect(report.transactions[0].items[0].unit_cost).toBe(10); expect(report.summary.totalCost).toBe(120);
  });
  it("calculates summaries across all pages and deduplicates item/transaction IDs without combining same-day deliveries", () => {
    const deliveries = Array.from({ length: 21 }, (_, i) => delivery(`delivery-${i}`, "2026-10-08T08:00:00Z"));
    const items = deliveries.map(row => line(`line-${row.id}`, row.id));
    const source = { ...supplySource, deliveries: [...deliveries, deliveries[0]], items: [...items, items[0]] };
    const report = buildSupplyReport(source, parseSupplyFilters({ month: "2026-10", page: 2 }));
    expect(report.transactions).toHaveLength(10); expect(report.totalPages).toBe(3);
    expect(report.summary).toMatchObject({ transactions: 21, uniqueProducts: 21, totalCost: 2100, quantities: [{ unit: "units", quantity: 210 }] });
    expect(new Set(report.transactions.map(row => row.id)).size).toBe(10);
    expect(buildSupplyReport(source, parseSupplyFilters({ month: "2026-10", page: 999 })).filters.page).toBe(3);
  });
  it("keeps units and grams separate, resolves former staff honestly, and labels non-manager recording roles", () => {
    const source = { ...supplySource, deliveries: [delivery("grams", "2026-10-08T08:00:00Z", "budhouse", "receptionist"), { ...delivery("units", "2026-10-08T07:00:00Z"), recorded_by: null }], items: [{ ...line("grams", "grams"), unit: "grams" as const }, line("units", "units")] };
    const report = buildSupplyReport(source, parseSupplyFilters({ month: "2026-10" }));
    expect(report.summary.quantities).toEqual([{ unit: "grams", quantity: 10 }, { unit: "units", quantity: 10 }]);
    expect(report.recorders).toContainEqual({ id: "receptionist", name: "Bongi Test (receptionist)" });
    expect(report.transactions[1].recordedBy).toBe("Recorded by unavailable");
  });
  it("distinguishes empty month, week and combined-filter results", () => {
    expect(buildSupplyReport(supplySource, parseSupplyFilters({ month: "2026-11" })).emptyReason).toBe("month");
    expect(buildSupplyReport(supplySource, parseSupplyFilters({ month: "2026-09", week: "2026-09-14" })).emptyReason).toBe("week");
    expect(buildSupplyReport(supplySource, parseSupplyFilters({ month: "2026-10", search: "absent" })).emptyReason).toBe("filters");
  });
});
