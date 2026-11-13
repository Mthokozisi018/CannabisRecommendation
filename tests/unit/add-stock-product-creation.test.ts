import { beforeEach, describe, expect, it, vi } from "vitest";

const storeId = "10000000-0000-4000-8000-000000000001";
const productId = "20000000-0000-4000-8000-000000000001";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), upload: vi.fn(), getPublicUrl: vi.fn(), normalize: vi.fn(), invalidate: vi.fn(), storageFrom: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/manager/auth", () => {
  const query = () => {
    const chain = { select: vi.fn(), eq: vi.fn(), ilike: vi.fn(), is: vi.fn(), maybeSingle: vi.fn(), update: vi.fn(), insert: vi.fn(), then: vi.fn() };
    chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain); chain.ilike.mockReturnValue(chain);
    chain.is.mockReturnValue(chain);
    chain.then.mockImplementation((resolve: (value: { error: null }) => unknown) => resolve({ error: null }));
    chain.maybeSingle.mockResolvedValue({ data: null, error: null });
    chain.update.mockReturnValue(chain); chain.insert.mockResolvedValue({ error: null });
    return chain;
  };
  return {
    requireActiveManager: async () => ({ supabase: { rpc: mocks.rpc }, user: { id: "manager" }, profile: { store_id: storeId } }),
    requireAdminClient: () => ({ from: () => query(), storage: { from: mocks.storageFrom } })
  };
});
vi.mock("@/lib/security", () => ({ verifyOrigin: vi.fn(), assertRateLimit: vi.fn() }));
vi.mock("@/lib/cache/redis", () => ({ invalidateStoreDisplayCache: mocks.invalidate, invalidateManagerStaffCache: vi.fn() }));
vi.mock("@/lib/manager/data", () => ({ edibleThcDatabaseFields: vi.fn() }));
vi.mock("@/lib/product-image-upload", () => ({ normalizeProductImage: mocks.normalize, productImageObjectPath: () => `stores/${storeId}/products/${productId}/photo.webp` }));
vi.mock("@/lib/staff-password-reset", () => ({ sendStaffPasswordResetLink: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { createProductAction } from "@/app/dashboard/manager/actions";

describe("zero-stock Pre-Rolls registration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ data: [{ product_id: productId, current_quantity: 0 }], error: null });
    mocks.normalize.mockResolvedValue({ data: Buffer.from("photo"), contentType: "image/webp", extension: "webp", width: 1, height: 1 });
    mocks.upload.mockResolvedValue({ error: null });
    mocks.getPublicUrl.mockReturnValue({ data: { publicUrl: "https://example.supabase.co/storage/v1/object/public/product-images/photo.webp" } });
    mocks.storageFrom.mockReturnValue({ upload: mocks.upload, getPublicUrl: mocks.getPublicUrl });
  });

  it("creates zero inventory without a receipt and saves the uploaded image reference", async () => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ workflow: "add-stock", productName: "New Pre-Roll", category: "Pre-Rolls", subcategory: "Hybrid", cultivationType: "Indoor", price: "35", productStatus: "active", initialStockQuantity: "0", supplierId: "", supplierUnitCost: "" })) form.set(key, value);
    form.set("productImage", new File(["photo"], "photo.png", { type: "image/png" }));
    const result = await createProductAction({ ok: false, message: "" }, form);
    expect(result.ok).toBe(true);
    expect(result.createdProduct?.inventory_stock?.current_quantity).toBe(0);
    expect(result.createdProduct?.image_url).toContain("/product-images/photo.webp");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("create_product_without_stock_atomic", expect.objectContaining({ p_initial_stock: 0 }));
    expect(mocks.upload).toHaveBeenCalledTimes(1);
  });
});
