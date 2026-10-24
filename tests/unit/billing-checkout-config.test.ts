import { describe, expect, it, vi } from "vitest";
import { paystackCheckoutCallbackUrl } from "@/lib/billing/checkout-config";

vi.mock("server-only", () => ({}));

const configured: Record<string, string | undefined> = {
  GREENCHOICE_ENV: "staging",
  PAYSTACK_MODE: "test",
  PAYSTACK_BILLING_ENABLED: "true",
  PAYSTACK_SECRET_KEY: "sk_test_fixture_not_a_real_key",
  APP_URL: "https://staging.example.com",
  PAYSTACK_CALLBACK_URL: "https://staging.example.com/billing/payment/callback",
};

describe("Paystack checkout configuration", () => {
  it("accepts the exact HTTPS callback on the staging origin", () => {
    expect(paystackCheckoutCallbackUrl(configured)).toBe(configured.PAYSTACK_CALLBACK_URL);
  });

  it("accepts live-mode billing only with a live key on the production origin", () => {
    const production = { ...configured, GREENCHOICE_ENV: "production", APP_URL: "https://greenchoice-workstation.vercel.app",
      PAYSTACK_CALLBACK_URL: "https://greenchoice-workstation.vercel.app/billing/payment/callback",
      PAYSTACK_MODE: "live", PAYSTACK_SECRET_KEY: "sk_live_fixture_not_a_real_key" };
    expect(paystackCheckoutCallbackUrl(production)).toBe(production.PAYSTACK_CALLBACK_URL);
    expect(paystackCheckoutCallbackUrl({ ...production, PAYSTACK_MODE: "test" })).toBeNull();
    expect(paystackCheckoutCallbackUrl({ ...production, PAYSTACK_SECRET_KEY: configured.PAYSTACK_SECRET_KEY })).toBeNull();
    expect(paystackCheckoutCallbackUrl({ ...configured, GREENCHOICE_ENV: "production", APP_URL: production.APP_URL,
      PAYSTACK_CALLBACK_URL: production.PAYSTACK_CALLBACK_URL })).toBeNull();
  });

  it.each([
    { PAYSTACK_CALLBACK_URL: "" },
    { APP_URL: "http://127.0.0.1:3001", PAYSTACK_CALLBACK_URL: "http://127.0.0.1:3001/billing/payment/callback" },
    { APP_URL: "https://localhost:3001", PAYSTACK_CALLBACK_URL: "https://localhost:3001/billing/payment/callback" },
    { PAYSTACK_CALLBACK_URL: "https://elsewhere.example.com/billing/payment/callback" },
    { PAYSTACK_SECRET_KEY: "sk_live_forbidden" },
    { GREENCHOICE_ENV: "development" },
  ])("rejects an unusable or unsafe callback: %j", (override) => {
    expect(paystackCheckoutCallbackUrl({ ...configured, ...override })).toBeNull();
  });
});
