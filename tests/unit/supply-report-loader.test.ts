import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { authorize, from, requests } = vi.hoisted(() => ({ authorize: vi.fn(), from: vi.fn(), requests: [] as { table: string; select: string; predicates: [string, string, unknown][]; range?: [number, number] }[] }));
vi.mock("@/lib/manager/auth", () => ({ requireActiveManager: authorize }));
import { getManagerSupplyReport } from "@/lib/manager/supply-report";
import { supplySource, delivery, line } from "@/tests/fixtures/supply-report";

describe("store-scoped supply report loader", () => {
  beforeEach(() => {
    vi.clearAllMocks(); requests.length = 0;
    authorize.mockResolvedValue({ profile: { store_id: "store-a" }, supabase: { from } });
    from.mockImplementation(table => {
      const request = { table, select: "", predicates: [] as [string, string, unknown][], range: undefined as [number, number] | undefined }; requests.push(request);
      const query = {
        select: (value: string) => { request.select = value; return query; },
        eq: (column: string, value: unknown) => { request.predicates.push(["eq", column, value]); return query; },
        gte: (column: string, value: unknown) => { request.predicates.push(["gte", column, value]); return query; },
        lt: (column: string, value: unknown) => { request.predicates.push(["lt", column, value]); return query; },
        in: (column: string, value: unknown) => { request.predicates.push(["in", column, value]); return query; },
        order: () => query,
        range: async (start: number, end: number) => {
          request.range = [start, end];
          const rows = table === "suppliers" ? supplySource.suppliers : table === "staff_profiles" ? supplySource.staff : table === "supply_delivery_items" ? supplySource.items : request.select === "recorded_by" ? supplySource.deliveries.map(row => ({ recorded_by: row.recorded_by })) : supplySource.deliveries;
          return { data: rows.slice(start, end + 1), error: null };
        },
      };
      return query;
    });
  });
  it("uses authenticated RLS reads with explicit store predicates, recording-time month bounds and selected delivery IDs", async () => {
    const report = await getManagerSupplyReport({ month: "2026-10" });
    expect(report.transactions).toHaveLength(2);
    expect(requests.every(request => request.predicates.some(([operator, column, value]) => operator === "eq" && column === "store_id" && value === "store-a"))).toBe(true);
    const deliveries = requests.find(request => request.table === "supply_deliveries" && request.select !== "recorded_by")!;
    expect(deliveries.predicates).toContainEqual(["gte", "created_at", "2026-09-30T22:00:00.000Z"]);
    expect(deliveries.predicates).toContainEqual(["lt", "created_at", "2026-10-31T22:00:00.000Z"]);
    expect(deliveries.select).not.toContain("notes");
    const items = requests.find(request => request.table === "supply_delivery_items")!;
    expect(items.predicates).toContainEqual(["in", "delivery_id", supplySource.deliveries.map(delivery => delivery.id)]);
    expect(items.range).toEqual([0, 199]);
    expect(items.select.split(",")).toContain("product_id");
  });
  it("does not read any tables for unauthorized or unassigned accounts", async () => {
    authorize.mockRejectedValueOnce(new Error("Manager access required"));
    await expect(getManagerSupplyReport()).rejects.toThrow("Manager access required"); expect(from).not.toHaveBeenCalled();
    authorize.mockResolvedValueOnce({ profile: { store_id: null }, supabase: { from } });
    await expect(getManagerSupplyReport()).rejects.toThrow(); expect(from).not.toHaveBeenCalled();
  });
  it("rejects a client-supplied store ID and fails closed on database errors", async () => {
    await expect(getManagerSupplyReport({ month: "2026-10", storeId: "store-b" })).rejects.toThrow(); expect(from).not.toHaveBeenCalled();
    from.mockImplementationOnce(() => {
      const query = { select: () => query, eq: () => query, gte: () => query, lt: () => query, order: () => query, range: async () => ({ data: null, error: { message: "private database details" } }) };
      return query;
    });
    await expect(getManagerSupplyReport({ month: "2026-10" })).rejects.toThrow("Supply history could not be loaded.");
  });
  it("returns only one browser page while summarising more than 200 monthly transactions", async () => {
    const deliveries = Array.from({ length: 205 }, (_, i) => delivery(`delivery-${i}`, "2026-10-08T08:00:00Z"));
    const items = deliveries.map(row => line(`line-${row.id}`, row.id));
    from.mockImplementation(table => {
      const request = { table, select: "", predicates: [] as [string, string, unknown][], range: undefined as [number, number] | undefined }; requests.push(request);
      const query = { select: (value: string) => { request.select = value; return query; }, eq: () => query, gte: () => query, lt: () => query, order: () => query,
        in: (_column: string, ids: string[]) => { request.predicates.push(["in", "delivery_id", ids]); return query; },
        range: async (start: number, end: number) => {
          request.range = [start, end];
          const ids = request.predicates.find(([operator]) => operator === "in")?.[2] as string[] | undefined;
          const rows = table === "suppliers" ? supplySource.suppliers : table === "staff_profiles" ? supplySource.staff : table === "supply_delivery_items" ? items.filter(item => ids?.includes(item.delivery_id)) : request.select === "recorded_by" ? deliveries.map(delivery => ({ recorded_by: delivery.recorded_by })) : deliveries;
          return { data: rows.slice(start, end + 1), error: null };
        } };
      return query;
    });
    const report = await getManagerSupplyReport({ month: "2026-10", page: 2 });
    expect(report.transactions).toHaveLength(10); expect(report.summary).toMatchObject({ transactions: 205, totalCost: 20500 });
    expect(requests.some(request => request.range?.[0] === 200)).toBe(true);
    expect(report.transactions.flatMap(transaction => transaction.items)).toHaveLength(10);
  });
});
