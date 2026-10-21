import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ db: vi.fn(), callback: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/billing/accounts", () => ({ billingDb: mocks.db }));
vi.mock("@/lib/billing/checkout-config", () => ({ paystackCheckoutCallbackUrl: mocks.callback }));
vi.mock("@/lib/billing/paystack", () => ({ initializePaystackCheckout: vi.fn(), paymentMatchesExpected: vi.fn(), verifyPaystackTransaction: vi.fn() }));
vi.mock("@/lib/billing/subscriptions", () => ({ provisionSubscription: vi.fn() }));

import { beginOnboardingCheckout } from "@/lib/billing/transactions";

it("rejects missing callback before touching billing payment storage", async () => {
  mocks.callback.mockReturnValue(null);
  await expect(beginOnboardingCheckout({ id: "account-1" } as never, "owner@example.com"))
    .rejects.toThrow("The public staging Paystack callback is not configured.");
  expect(mocks.db).not.toHaveBeenCalled();
});
