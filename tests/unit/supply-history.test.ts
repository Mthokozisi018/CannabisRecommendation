import { describe, expect, it } from "vitest";
import { groupSupplyHistory, supplyMonth, supplyPeriodLabel } from "@/lib/manager/supply-history";
import type { SupplyHistoryEntry } from "@/lib/manager/suppliers";

function receipt(id: string, receivedAt: string, quantity: number, lineTotal: number, overrides: Partial<SupplyHistoryEntry> = {}): SupplyHistoryEntry {
  return { id, deliveryId: id, reference: id, supplierId: "a", supplierName: "Supplier A", receivedAt, recordedBy: "Manager", productId: id, productName: "Flower", category: "Flower", subcategory: "Indoor", cultivationType: null, quantity, unit: "units", unitCost: lineTotal / quantity, lineTotal, ...overrides };
}

describe("monthly supply history display", () => {
  const october = [receipt("1", "2026-10-03T10:00:00Z", 10, 2000), receipt("2", "2026-10-08T10:00:00Z", 20, 1500), receipt("3", "2026-10-19T10:00:00Z", 15, 1200)];
  it("lists current-month deliveries separately then summarizes the completed month without modifying receipts", () => {
    const original = structuredClone(october);
    expect(groupSupplyHistory(october, "2026-10").map((row) => row.kind)).toEqual(["delivery", "delivery", "delivery"]);
    const rows = groupSupplyHistory(october, "2026-11");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "month", supplies: 3, quantities: [{ unit: "units", quantity: 45 }], totalCost: 4700 });
    expect(rows[0].entries.map((entry) => entry.id)).toEqual(["3", "2", "1"]);
    expect(october).toEqual(original);
    expect(supplyPeriodLabel(rows[0].period)).toBe("October 2026");
  });
  it("counts deliveries rather than product lines and preserves separate units and exact cost cents", () => {
    const rows = groupSupplyHistory([receipt("1", "2026-10-03T10:00:00Z", 10, 0.1), receipt("2", "2026-10-03T10:00:00Z", 20, 0.2, { deliveryId: "1", unit: "grams" })], "2026-11");
    expect(rows[0]).toMatchObject({ supplies: 1, totalCost: 0.3 });
    expect(rows[0].quantities).toEqual([{ unit: "units", quantity: 10 }, { unit: "grams", quantity: 20 }]);
  });
  it("keeps suppliers and years separate and starts the new month with individual deliveries", () => {
    const rows = groupSupplyHistory([...october, receipt("b", "2026-10-03T10:00:00Z", 1, 10, { supplierId: "b" }), receipt("new", "2026-11-01T10:00:00Z", 1, 10), receipt("old", "2025-10-03T10:00:00Z", 1, 10)], "2026-11");
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({ kind: "delivery", period: "2026-11" });
    expect(rows.filter((row) => row.period === "2026-10")).toHaveLength(2);
    expect(groupSupplyHistory([], "2026-11")).toEqual([]);
  });
  it("rolls over at midnight Johannesburg time, including the year boundary", () => {
    expect(supplyMonth("2026-10-31T21:59:59Z")).toBe("2026-10");
    expect(supplyMonth("2026-10-31T22:00:00Z")).toBe("2026-11");
    const entry = receipt("new-year", "2026-12-31T22:00:00Z", 1, 10);
    expect(groupSupplyHistory([entry], "2027-01")[0].kind).toBe("delivery");
    expect(groupSupplyHistory([entry], "2027-02")[0].kind).toBe("month");
  });
});
