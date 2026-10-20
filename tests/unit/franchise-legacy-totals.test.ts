import { describe, expect, it } from "vitest";
import { adjustLegacyTotals } from "@/lib/franchise/legacy-totals";

describe("legacy franchise totals", () => {
  it("subtracts refunded cents from the correct Johannesburg day and store", () => {
    const result = adjustLegacyTotals({
      daily: [
        { store_id: "one", day: "2026-10-02", revenue: 20.11, transactions: 2 },
        { store_id: "two", day: "2026-10-02", revenue: 9, transactions: 1 },
      ],
      customers: [{ store_id: "one", count: 3 }],
    }, [
      { store_id: "one", created_at: "2026-10-01T22:30:00Z", total: "10.105", refunded_amount: "5.005" },
    ]);
    expect(result.daily).toEqual([
      { store_id: "one", day: "2026-10-02", revenue: 15.10, transactions: 2 },
      { store_id: "two", day: "2026-10-02", revenue: 9, transactions: 1 },
    ]);
    expect(result.customers).toEqual([{ store_id: "one", count: 3 }]);
  });
});
