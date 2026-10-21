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

  it.each([
    { PAYSTACK_CALLBACK_URL: "" },
    { APP_URL: "http://127.0.0.1:3001", PAYSTACK_CALLBACK_URL: "http://127.0.0.1:3001/billing/payment/callback" },
    { APP_URL: "https://localhost:3001", PAYSTACK_CALLBACK_URL: "https://localhost:3001/billing/payment/callback" },
    { PAYSTACK_CALLBACK_URL: "https://elsewhere.example.com/billing/payment/callback" },
    { PAYSTACK_SECRET_KEY: "sk_live_forbidden" },
    { GREENCHOICE_ENV: "production" },
  ])("rejects an unusable or unsafe callback: %j", (override) => {
    expect(paystackCheckoutCallbackUrl({ ...configured, ...override })).toBeNull();
  });
});
