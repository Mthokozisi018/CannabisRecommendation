import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(), owner: vi.fn(), begin: vi.fn(), callback: vi.fn(),
  origin: vi.fn(), limit: vi.fn(), card: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
vi.mock("@/lib/dashboard-session", () => ({ getDashboardSession: mocks.session }));
vi.mock("@/lib/billing/accounts", () => ({ requireBillingOwner: mocks.owner }));
vi.mock("@/lib/billing/transactions", () => ({ beginOnboardingCheckout: mocks.begin, beginRecoveryCheckout: vi.fn() }));
vi.mock("@/lib/billing/subscriptions", () => ({ cardUpdateUrl: mocks.card }));
vi.mock("@/lib/billing/checkout-config", () => ({ paystackCheckoutCallbackUrl: mocks.callback }));
vi.mock("@/lib/security", () => ({ verifyOrigin: mocks.origin, assertRateLimit: mocks.limit }));

import { startOnboardingCheckoutAction } from "@/app/billing/actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ authUserId: "user-1", email: "owner@example.com" });
  mocks.owner.mockResolvedValue({ id: "account-1" });
  mocks.callback.mockReturnValue("https://staging.example.com/billing/payment/callback");
  mocks.begin.mockResolvedValue("https://checkout.paystack.com/test-session");
});

it("requires an authenticated billing owner before checkout", async () => {
  mocks.owner.mockRejectedValueOnce(new Error("Billing owner access is required."));
  await expect(startOnboardingCheckoutAction()).rejects.toThrow("Billing owner access is required.");
  expect(mocks.begin).not.toHaveBeenCalled();
});

it("returns to billing when the public callback is not configured", async () => {
  mocks.callback.mockReturnValueOnce(null);
  await expect(startOnboardingCheckoutAction()).rejects.toThrow("redirect:/billing?checkoutError=configuration");
  expect(mocks.begin).not.toHaveBeenCalled();
});

it("handles Paystack initialization errors without exposing them to the browser", async () => {
  mocks.begin.mockRejectedValueOnce(new Error("private provider detail"));
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    await expect(startOnboardingCheckoutAction()).rejects.toThrow("redirect:/billing?checkoutError=provider");
    expect(log).toHaveBeenCalledOnce();
  } finally {
    log.mockRestore();
  }
});

it("preserves the hosted checkout redirect on success", async () => {
  await expect(startOnboardingCheckoutAction()).rejects.toThrow("redirect:https://checkout.paystack.com/test-session");
  expect(mocks.begin).toHaveBeenCalledWith({ id: "account-1" }, "owner@example.com");
});
