import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const rpcMock = vi.fn();
const invalidateStoreDisplayCacheMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("@/lib/security", () => ({
  assertRateLimit: vi.fn().mockResolvedValue({
    allowed: true,
    limit: 20,
    remaining: 19,
    retryAfterSeconds: 0,
    resetAt: Date.now() + 60_000
  }),
  verifyOrigin: vi.fn().mockResolvedValue(true)
}));

vi.mock("@/lib/dal/auth", () => ({
  requireStaff: vi.fn().mockResolvedValue({
    id: "11111111-1111-4111-8111-111111111111",
    storeId: "22222222-2222-4222-8222-222222222222",
    storeAccessStatus: "active"
  })
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    rpc: rpcMock
  }))
}));

vi.mock("@/lib/cache/redis", () => ({
  invalidateStoreDisplayCache: invalidateStoreDisplayCacheMock
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock
}));

describe("receptionist checkout action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpcMock.mockResolvedValue({
      data: {
        sale_id: "33333333-3333-4333-8333-333333333333",
        subtotal: 300,
        total: 300,
        already_completed: false
      },
      error: null
    });
  });

  it("checks out products added to the cart through the atomic Supabase sale RPC", async () => {
    const { checkoutReceptionistSaleAction } = await import("@/app/dashboard/receptionist/actions");

    const result = await checkoutReceptionistSaleAction({
      checkoutId: "44444444-4444-4444-8444-444444444444",
      items: [
        {
          productId: "55555555-5555-4555-8555-555555555555",
          quantity: 2,
          unitPrice: 150
        }
      ]
    });

    expect(result).toEqual({
      ok: true,
      message: "Sale completed successfully.",
      saleId: "33333333-3333-4333-8333-333333333333"
    });
    expect(rpcMock).toHaveBeenCalledWith("complete_receptionist_sale_v2", {
      p_checkout_id: "44444444-4444-4444-8444-444444444444",
      p_auth_user_id: "11111111-1111-4111-8111-111111111111",
      p_items: [
        {
          productId: "55555555-5555-4555-8555-555555555555",
          quantity: 2,
          unitPrice: 150
        }
      ]
    });
    expect(invalidateStoreDisplayCacheMock).toHaveBeenCalledWith("22222222-2222-4222-8222-222222222222");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/receptionist/products");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/manager");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/manager/inventory");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/manager/sales");
  });

  it("returns a review-cart error when the sale RPC reports stock or product changes", async () => {
    const { checkoutReceptionistSaleAction } = await import("@/app/dashboard/receptionist/actions");
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "Insufficient stock." }
    });

    const result = await checkoutReceptionistSaleAction({
      checkoutId: "44444444-4444-4444-8444-444444444444",
      items: [
        {
          productId: "55555555-5555-4555-8555-555555555555",
          quantity: 2,
          unitPrice: 150
        }
      ]
    });

    expect(result).toEqual({
      ok: false,
      message: "The cart changed while checkout was processing. Review the cart and try again."
    });
  });
});
