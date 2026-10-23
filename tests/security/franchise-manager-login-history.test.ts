import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ auth: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/franchise/auth", () => ({ requireFranchiseStore: mocks.auth }));
import { getManagerLoginHistory } from "@/lib/franchise/manager-login-history";
import { loadManagerLoginHistory } from "@/app/dashboard/franchise/stores/login-history-actions";
const storeId = "30000000-0000-4000-8000-000000000001";
const manager = "10000000-0000-4000-8000-000000000001";
let query: Record<string, ReturnType<typeof vi.fn>>;
beforeEach(() => {
  vi.clearAllMocks();
  query = {};
  for (const method of ["select", "eq", "gte", "lt", "order"]) query[method] = vi.fn(() => query);
  query.range = vi.fn().mockResolvedValue({ data: [], error: null });
  mocks.from.mockReturnValue(query);
  mocks.auth.mockResolvedValue({ store: { id: storeId }, supabase: { from: mocks.from } });
});
it("requires store ownership before any audit read, including action requests", async () => {
  mocks.auth.mockRejectedValue(Error("Store not found in your franchise."));
  await expect(loadManagerLoginHistory(storeId, {})).rejects.toThrow("Store not found");
  expect(mocks.from).not.toHaveBeenCalled();
});
it("queries only authorized-store manager login events with stable descending bounded pagination", async () => {
  query.range.mockResolvedValue({ data: Array.from({ length: 26 }, (_, i) => ({ id: String(i) })), error: null });
  const page = await loadManagerLoginHistory(storeId, { page: 2 });
  expect(mocks.auth).toHaveBeenCalledWith(storeId);
  expect(mocks.from).toHaveBeenCalledWith("audit_logs");
  expect(query.eq.mock.calls).toEqual([["store_id", storeId], ["action", "login_success"], ["details->>role", "manager"]]);
  expect(query.order.mock.calls).toEqual([["created_at", { ascending: false }], ["id", { ascending: false }]]);
  expect(query.range).toHaveBeenCalledWith(25, 50);
  expect(page.rows).toHaveLength(25);
  expect(page.hasNext).toBe(true);
});
it("applies dates in South African time, manager and actual recorded status without broadening scope", async () => {
  await getManagerLoginHistory(storeId, { from: "2026-10-14", to: "2026-10-15", manager, status: "success" });
  expect(query.eq).toHaveBeenCalledWith("user_id", manager);
  expect(query.eq).toHaveBeenCalledWith("result", "success");
  expect(query.gte).toHaveBeenCalledWith("created_at", "2026-10-14T00:00:00+02:00");
  expect(query.lt).toHaveBeenCalledWith("created_at", "2026-10-15T22:00:00.000Z");
});
it("rejects malformed and inverted filters before querying", async () => {
  for (const input of [{from:"2026-02-30"}, {from:"2026-99-01"}, {from:"2026-10-16",to:"2026-10-15"}, {manager:"bad-id"}, {page:0}, {status:"failed"}]) {
    await expect(getManagerLoginHistory(storeId, input as never)).rejects.toThrow();
  }
  expect(mocks.from).not.toHaveBeenCalled();
});
it("fails on audit read errors and refetches on refresh rather than caching activity", async () => {
  query.range.mockResolvedValueOnce({ data: null, error: { code: "42501" } });
  await expect(getManagerLoginHistory(storeId)).rejects.toThrow("could not be loaded");
  await expect(getManagerLoginHistory(storeId)).resolves.toMatchObject({ rows: [], hasNext: false });
  expect(query.range).toHaveBeenCalledTimes(2);
});
