import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const rpcMock = vi.fn();
const invalidateStoreDisplayCacheMock = vi.fn();
const revalidatePathMock = vi.fn();
const afterMock = vi.fn((task: () => unknown) => task());

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

vi.mock("next/server", () => ({
  after: afterMock
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
      customerId: "66666666-6666-4666-8666-666666666666",
      payment: { method: "cash", cashAmount: 300, cardAmount: 0 },
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
    expect(rpcMock).toHaveBeenCalledWith("complete_receptionist_sale_v3", {
      p_checkout_id: "44444444-4444-4444-8444-444444444444",
      p_auth_user_id: "11111111-1111-4111-8111-111111111111",
      p_customer_id: "66666666-6666-4666-8666-666666666666",
      p_payment_method: "cash",
      p_cash_amount: 300,
      p_card_amount: 0,
      p_items: [
        {
          productId: "55555555-5555-4555-8555-555555555555",
          quantity: 2,
          unitPrice: 150
        }
      ]
    });
    expect(afterMock).toHaveBeenCalledTimes(1);
    await Promise.resolve();
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
      customerId: "66666666-6666-4666-8666-666666666666",
      payment: { method: "cash", cashAmount: 300, cardAmount: 0 },
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
  it.each([
    { method: "cash", cashAmount: 750, cardAmount: 0 },
    { method: "card", cashAmount: 0, cardAmount: 750 },
    { method: "split", cashAmount: 300, cardAmount: 450 }
  ] as const)("sends $method allocation to the atomic RPC", async (payment) => {
    const { checkoutReceptionistSaleAction } = await import("@/app/dashboard/receptionist/actions");
    const result = await checkoutReceptionistSaleAction({
      checkoutId: "44444444-4444-4444-8444-444444444444",
      customerId: "66666666-6666-4666-8666-666666666666",
      payment,
      items: [{ productId: "55555555-5555-4555-8555-555555555555", quantity: 1, unitPrice: 750 }]
    });
    expect(result.ok).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith("complete_receptionist_sale_v3", expect.objectContaining({
      p_payment_method: payment.method, p_cash_amount: payment.cashAmount, p_card_amount: payment.cardAmount
    }));
  });

  it.each([
    { method: "split", cashAmount: 300, cardAmount: 449 },
    { method: "split", cashAmount: -1, cardAmount: 751 },
    { method: "split", cashAmount: 751, cardAmount: 0 },
    { method: "split", cashAmount: 300.001, cardAmount: 449.999 },
    { method: "cash", cashAmount: 0, cardAmount: 750 },
    { method: "card", cashAmount: 750, cardAmount: 0 }
  ] as const)("rejects invalid allocation before any write: %o", async (payment) => {
    const { checkoutReceptionistSaleAction } = await import("@/app/dashboard/receptionist/actions");
    const result = await checkoutReceptionistSaleAction({
      checkoutId: "44444444-4444-4444-8444-444444444444",
      customerId: "66666666-6666-4666-8666-666666666666",
      payment,
      items: [{ productId: "55555555-5555-4555-8555-555555555555", quantity: 1, unitPrice: 750 }]
    });
    expect(result.ok).toBe(false);
    expect(rpcMock).not.toHaveBeenCalled();
  });

});
