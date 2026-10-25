import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ store: vi.fn() }));
vi.mock("@/lib/franchise/auth", () => ({
  requireFranchiseAdmin: vi.fn(),
  requireFranchiseStore: mocks.store,
}));
import { getStoreSaleItems } from "@/lib/franchise/data";
import { reportPeriod } from "@/lib/franchise/reporting";
const period = reportPeriod({ from: "2026-10-01", to: "2026-10-13" });
beforeEach(() => vi.clearAllMocks());
it("authorizes the store before reading any sales or items", async () => {
  mocks.store.mockRejectedValueOnce(Error("Store not found in your franchise."));
  await expect(getStoreSaleItems("foreign-store", period)).rejects.toThrow("Store not found");
});
it("scopes sales and paginates all sales and items in bounded batches", async () => {
  const sales = Array.from({ length: 501 }, (_, i) => ({ id: `sale-${i}` }));
  const queries: { table: string; query: Record<string, ReturnType<typeof vi.fn>> }[] = [];
  const from = vi.fn((table: string) => {
    const query: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const method of ["select", "eq", "gte", "lt", "order", "in"])
      query[method] = vi.fn(() => query);
    query.range = vi.fn((start: number, end: number) => {
      const ids = query.in.mock.calls[0]?.[1] as string[] | undefined;
      const rows = table === "pos_sales" ? sales : ids!.flatMap((sale_id) =>
        Array.from({ length: 6 }, () => ({ sale_id })),
      );
      return Promise.resolve({ data: rows.slice(start, end + 1), error: null });
    });
    queries.push({ table, query });
    return query;
  });
  mocks.store.mockResolvedValue({ franchiseId: "trusted-franchise", supabase: { from } });
  const items = await getStoreSaleItems("trusted-store", period);
  expect(items).toHaveLength(3006);
  for (const { table, query } of queries) {
    if (table === "pos_sales") {
      expect(query.eq.mock.calls).toEqual([
        ["stores.franchise_id", "trusted-franchise"],
        ["store_id", "trusted-store"],
        ["status", "completed"],
      ]);
      expect(query.gte).toHaveBeenCalledWith("created_at", period.start.toISOString());
      expect(query.lt).toHaveBeenCalledWith("created_at", period.end.toISOString());
    } else {
      const ids = query.in.mock.calls[0][1] as string[];
      expect(ids.length).toBeLessThanOrEqual(100);
      expect(ids.every((id) => sales.some((sale) => sale.id === id))).toBe(true);
      expect(query.select.mock.calls[0][0]).not.toContain("!inner");
    }
  }
});
it("skips item reads for an empty period and fails on query errors", async () => {
  const query = { select: vi.fn(), eq: vi.fn(), gte: vi.fn(), lt: vi.fn(), order: vi.fn(), range: vi.fn() };
  for (const method of [query.select, query.eq, query.gte, query.lt, query.order]) method.mockReturnValue(query);
  query.range.mockResolvedValue({ data: [], error: null });
  const from = vi.fn(() => query);
  mocks.store.mockResolvedValue({ franchiseId: "trusted-franchise", supabase: { from } });
  expect(await getStoreSaleItems("trusted-store", period)).toEqual([]);
  expect(from).toHaveBeenCalledTimes(1);
  query.range.mockResolvedValueOnce({ data: null, error: { code: "57014" } });
  await expect(getStoreSaleItems("trusted-store", period)).rejects.toThrow("Franchise data could not be loaded");
});
