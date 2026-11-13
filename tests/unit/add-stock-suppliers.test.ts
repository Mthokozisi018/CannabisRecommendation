import { beforeEach, expect, it, vi } from "vitest";

const storeId = "10000000-0000-4000-8000-000000000001";
const mocks = vi.hoisted(() => ({ from: vi.fn(), eq: vi.fn(), order: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/manager/auth", () => ({ requireActiveManager: async () => ({ supabase: { from: mocks.from }, profile: { store_id: storeId } }) }));
import { listAddStockSuppliers } from "@/lib/manager/add-stock-suppliers";

beforeEach(() => {
  vi.clearAllMocks();
  const query = { select: vi.fn(), eq: mocks.eq, order: mocks.order };
  query.select.mockReturnValue(query);
  mocks.from.mockReturnValue(query);
  mocks.eq.mockReturnValue(query);
  mocks.order.mockResolvedValue({ data: [{ id: "supplier-a", name: "Reusable Supplier" }], error: null });
});

it("reloads active suppliers for the assigned store on each page request", async () => {
  expect(await listAddStockSuppliers()).toEqual([{ id: "supplier-a", name: "Reusable Supplier", categories: [] }]);
  expect(await listAddStockSuppliers()).toEqual([{ id: "supplier-a", name: "Reusable Supplier", categories: [] }]);
  expect(mocks.from).toHaveBeenCalledTimes(2);
  expect(mocks.from).toHaveBeenCalledWith("suppliers");
  expect(mocks.eq).toHaveBeenCalledWith("store_id", storeId);
  expect(mocks.eq).toHaveBeenCalledWith("status", "active");
});
