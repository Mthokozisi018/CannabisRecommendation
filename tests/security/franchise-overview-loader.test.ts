import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  rpc: vi.fn(),
  store: vi.fn(),
  from: vi.fn(),
  eq: vi.fn(),
  history: vi.fn(),
}));
vi.mock("@/lib/franchise/auth", () => ({
  requireFranchiseAdmin: mocks.auth,
  requireFranchiseStore: mocks.store,
}));
vi.mock("@/lib/franchise/totals-cache", () => ({
  cachedFranchiseTotals: (_scope: unknown, load: () => unknown) => load(),
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({
    franchiseId: "trusted-franchise",
    session: { authUserId: "trusted-user" },
    supabase: { rpc: mocks.rpc, from: mocks.from },
  });
  const query = { select: vi.fn().mockReturnThis(), eq: mocks.eq.mockReturnThis(), lte: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: mocks.history, range: vi.fn().mockResolvedValue({ data: [{ id: "trusted-store" }], error: null }) };
  mocks.from.mockReturnValue(query);
  mocks.history.mockResolvedValue({ data: [{ created_at: "2024-02-01T09:00:00Z" }], error: null });
  mocks.rpc.mockResolvedValue({
    data: { daily: [], customers: [] },
    error: null,
  });
});
it("checks store ownership before loading independent store periods and keeps aggregate reads scoped", async () => {
  const { loadStoreRevenuePeriod, loadStoreDetailPeriod } =
    await import("@/app/dashboard/franchise/sales/actions");
  const input = { from: "2026-10-01", to: "2026-10-13" };
  mocks.store.mockRejectedValueOnce(Error("Foreign store"));
  await expect(loadStoreRevenuePeriod("foreign", input)).rejects.toThrow(
    "Foreign store",
  );
  mocks.store.mockRejectedValueOnce(Error("Foreign store"));
  await expect(loadStoreDetailPeriod("foreign", input)).rejects.toThrow(
    "Foreign store",
  );
  expect(mocks.rpc).not.toHaveBeenCalled();
  mocks.store.mockResolvedValue({ franchiseId: "trusted-franchise" });
  await loadStoreRevenuePeriod("trusted-store", input);
  expect(mocks.store).toHaveBeenLastCalledWith("trusted-store");
  expect(mocks.rpc).toHaveBeenLastCalledWith("franchise_dashboard_totals_v3", {
    p_franchise_id: "trusted-franchise",
    p_store_id: "trusted-store",
    p_customers: false,
    p_start: "2026-09-30T22:00:00.000Z",
    p_end: "2026-10-13T22:00:00.000Z",
  });
  await expect(
    loadStoreRevenuePeriod("trusted-store", { from: "", to: input.to }),
  ).rejects.toThrow("Choose both reporting dates");
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
});
it("derives franchise from authentication, validates date bounds and issues just one aggregate without directory/customer reads", async () => {
  const { loadFranchiseSalesPeriod } =
    await import("@/app/dashboard/franchise/sales/actions");
  const input = {
    from: "2025-05-01",
    to: "2025-05-31",
    franchiseId: "forged",
    storeId: "forged",
    userId: "forged",
  };
  expect(await loadFranchiseSalesPeriod(input)).toEqual({
    from: input.from,
    to: input.to,
    daily: [],
  });
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
  expect(mocks.rpc).toHaveBeenCalledWith("franchise_dashboard_totals_v3", {
    p_franchise_id: "trusted-franchise",
    p_start: "2025-04-30T22:00:00.000Z",
    p_end: "2025-05-31T22:00:00.000Z",
    p_store_id: null,
    p_customers: false,
  });
});
it("does not query after denied authentication, invalid dates or inverted/excessive ranges", async () => {
  const { loadFranchiseSalesPeriod } =
    await import("@/app/dashboard/franchise/sales/actions");
  mocks.auth.mockRejectedValueOnce(Error("Access denied"));
  await expect(
    loadFranchiseSalesPeriod({ from: "2026-10-01", to: "2026-10-13" }),
  ).rejects.toThrow("Access denied");
  for (const p of [
    { from: "", to: "2026-10-13" },
    { from: "2026-10-01", to: "" },
    { from: "2026-02-30", to: "2026-03-01" },
    { from: "2026-10-13", to: "2026-10-12" },
    { from: "2020-01-01", to: "2026-01-01" },
  ])
    await expect(loadFranchiseSalesPeriod(p)).rejects.toThrow();
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("fails closed on aggregate errors rather than returning zero or fabricated revenue", async () => {
  const { loadFranchiseSalesPeriod } =
    await import("@/app/dashboard/franchise/sales/actions");
  mocks.rpc.mockResolvedValueOnce({
    data: null,
    error: { message: "unavailable" },
  });
  await expect(
    loadFranchiseSalesPeriod({ from: "2026-10-01", to: "2026-10-13" }),
  ).rejects.toThrow("Dashboard totals could not be loaded");
});

it("bounds multi-year reporting by authenticated recorded-sales history and ignores forged scope", async () => {
  const { loadFranchiseHistoricalSalesRange } = await import("@/app/dashboard/franchise/sales/actions");
  const result = await loadFranchiseHistoricalSalesRange({ from: "2024-01-01", to: "2026-10-13", franchiseId: "forged", storeId: "foreign" } as never);
  expect(result).toEqual({ from: "2024-01-01", to: "2026-10-13", daily: [] });
  expect(mocks.from).toHaveBeenCalledWith("pos_sales");
  expect(mocks.eq).toHaveBeenCalledWith("stores.franchise_id", "trusted-franchise");
  expect(mocks.eq).toHaveBeenCalledWith("status", "completed");
  expect(mocks.history).toHaveBeenCalledWith(1);
  expect(mocks.rpc).toHaveBeenCalledWith("franchise_dashboard_totals_v3", {
    p_franchise_id: "trusted-franchise", p_store_id: null, p_customers: false,
    p_start: "2023-12-31T22:00:00.000Z", p_end: "2026-10-13T22:00:00.000Z",
  });
});
it("rejects denied access, pre-history/future bounds and history read failures without aggregates", async () => {
  const { loadFranchiseHistoricalSalesRange } = await import("@/app/dashboard/franchise/sales/actions");
  mocks.auth.mockRejectedValueOnce(Error("Access denied"));
  await expect(loadFranchiseHistoricalSalesRange({ from: "2024-01-01", to: "2026-10-13" })).rejects.toThrow("Access denied");
  expect(mocks.from).not.toHaveBeenCalled();
  for (const input of [{ from: "2023-01-01", to: "2026-10-13" }, { from: "2024-01-01", to: "2099-01-01" }]) await expect(loadFranchiseHistoricalSalesRange(input)).rejects.toThrow("available sales history");
  mocks.history.mockResolvedValueOnce({ data: null, error: { message: "offline" } });
  await expect(loadFranchiseHistoricalSalesRange({ from: "2024-01-01", to: "2026-10-13" })).rejects.toThrow("Sales history could not be loaded");
  expect(mocks.rpc).not.toHaveBeenCalled();
});


it("uses only completed sales from the authenticated store for its own history boundary", async () => {
  const { getFranchiseSalesHistory } = await import("@/lib/franchise/data");
  mocks.store.mockResolvedValue({ franchiseId: "trusted-franchise" });
  mocks.history.mockResolvedValueOnce({data:[{created_at:"2026-06-17T22:30:00Z"}],error:null});
  expect(await getFranchiseSalesHistory("trusted-store")).toBe("2026-06-18");
  expect(mocks.store).toHaveBeenCalledWith("trusted-store");
  expect(mocks.eq).toHaveBeenCalledWith("store_id", "trusted-store");
  expect(mocks.eq).toHaveBeenCalledWith("stores.franchise_id", "trusted-franchise");
  expect(mocks.eq).toHaveBeenCalledWith("status", "completed");
  mocks.store.mockRejectedValueOnce(Error("Foreign store"));
  mocks.from.mockClear();
  await expect(getFranchiseSalesHistory("foreign-store")).rejects.toThrow("Foreign store");
  expect(mocks.from).not.toHaveBeenCalled();
});

it("finds the earliest sale across indexed store lookups", async () => {
  const { getFranchiseSalesHistory } = await import("@/lib/franchise/data");
  const query = mocks.from.getMockImplementation()!("stores");
  query.range.mockResolvedValueOnce({ data: [{ id: "store-one" }, { id: "store-two" }], error: null });
  mocks.history
    .mockResolvedValueOnce({ data: [{ created_at: "2025-04-01T22:30:00Z" }], error: null })
    .mockResolvedValueOnce({ data: [{ created_at: "2024-02-01T22:30:00Z" }], error: null });
  expect(await getFranchiseSalesHistory()).toBe("2024-02-02");
  expect(mocks.eq).toHaveBeenCalledWith("store_id", "store-one");
  expect(mocks.eq).toHaveBeenCalledWith("store_id", "store-two");
  expect(mocks.history).toHaveBeenCalledTimes(2);
});
