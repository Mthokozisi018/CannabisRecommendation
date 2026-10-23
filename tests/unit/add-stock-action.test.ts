import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), single: vi.fn(), eq: vi.fn(), invalidate: vi.fn(), image: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/manager/auth", () => ({
  requireActiveManager: async () => ({ supabase: { rpc: mocks.rpc }, user: { id: "manager" }, profile: { store_id: "20000000-0000-4000-8000-000000000001" } }),
  requireAdminClient: () => ({ from: () => ({ select: () => ({ eq: mocks.eq }) }) })
}));
vi.mock("@/lib/security", () => ({ verifyOrigin: vi.fn(), assertRateLimit: vi.fn() }));
vi.mock("@/lib/cache/redis", () => ({ invalidateStoreDisplayCache: mocks.invalidate, invalidateManagerStaffCache: vi.fn() }));
vi.mock("@/lib/manager/data", () => ({ edibleThcDatabaseFields: vi.fn() }));
vi.mock("@/lib/product-image-upload", () => ({ normalizeProductImage: mocks.image, productImageObjectPath: vi.fn() }));
vi.mock("@/lib/staff-password-reset", () => ({ sendStaffPasswordResetLink: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
import { addInventoryStockAction } from "@/app/dashboard/manager/actions";

const invalidInputs: Record<string, string>[] = [
  { cultivationType: "Indoor" },
  { supplierId: "" },
  { quantityToAdd: "0" },
];

function form(overrides: Record<string, string> = {}) {
  const value = new FormData();
  for (const [key, item] of Object.entries({ workflow: "add-stock", category: "Accessories", subcategory: "Lighters", productId: "10000000-0000-4000-8000-000000000001", quantityToAdd: "2", cultivationType: "", supplierId: "30000000-0000-4000-8000-000000000001", supplierUnitCost: "10", ...overrides })) value.set(key, item);
  return value;
}
describe("Add Stock supplier receipts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.eq.mockReturnValue({ eq: mocks.eq, single: mocks.single });
    mocks.single.mockResolvedValue({ data: { id: "10000000-0000-4000-8000-000000000001", category: "Accessories", subcategory: "Lighters", cultivation_type: null, image_path: null }, error: null });
    mocks.rpc.mockResolvedValue({ data: [{ new_quantity: 12 }], error: null });
  });
  it("queries only the assigned store and sends supplier/cost to the atomic receipt RPC", async () => {
    const result = await addInventoryStockAction({ ok: false, message: "" }, form());
    expect(result.ok).toBe(true);
    expect(result.updatedStock).toBe(12);
    expect(mocks.eq).toHaveBeenCalledWith("store_id", "20000000-0000-4000-8000-000000000001");
    expect(mocks.rpc).toHaveBeenCalledWith("receive_inventory_stock_atomic", { p_product_id: "10000000-0000-4000-8000-000000000001", p_quantity: 2, p_supplier_id: "30000000-0000-4000-8000-000000000001", p_unit_cost: 10, p_reason: "supplier_delivery" });
  });
  it("does not write if the product is outside the manager store", async () => {
    mocks.single.mockResolvedValue({ data: null, error: { message: "No row" } });
    expect((await addInventoryStockAction({ ok: false, message: "" }, form())).ok).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("cannot bypass supplier receipt validation by omitting the UI workflow flag", async () => {
    const value = form({ supplierId: "" });
    value.delete("workflow");
    expect((await addInventoryStockAction({ ok: false, message: "" }, value)).ok).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each(invalidInputs)("rejects invalid input before a receipt: %o", async (invalid) => {
    expect((await addInventoryStockAction({ ok: false, message: "" }, form(invalid))).ok).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("reports a failed supplier authorization without claiming stock was saved", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "supplier_not_authorized" } });
    expect((await addInventoryStockAction({ ok: false, message: "" }, form())).ok).toBe(false);
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });
});
