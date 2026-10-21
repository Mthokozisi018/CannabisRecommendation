import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  pending: null as Record<string, unknown> | null,
  inserted: [] as Record<string, unknown>[],
  charged: [] as number[],
  storeCount: 1,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/billing/accounts", () => ({
  currentMonthlyPrice: async (account: { franchise_id: string | null }) => ({
    amountCents: account.franchise_id ? 250_000 + Math.max(state.storeCount - 1, 0) * 100_000 : 150_000,
    count: account.franchise_id ? state.storeCount : 1,
  }),
  billingDb: () => ({
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: state.pending, error: null }),
        insert: (value: Record<string, unknown>) => {
          state.inserted.push(value);
          state.pending = { id: "payment", status: "pending", ...value };
          return query;
        },
        single: async () => ({ data: state.pending, error: null }),
      };
      return query;
    },
  }),
}));
vi.mock("@/lib/billing/checkout-config", () => ({ paystackCheckoutCallbackUrl: () => "https://example.test/billing/payment/callback" }));
vi.mock("@/lib/billing/paystack", () => ({
  initializePaystackCheckout: async ({ amountCents }: { amountCents: number }) => {
    state.charged.push(amountCents);
    return "https://checkout.paystack.com/test";
  },
}));
vi.mock("@/lib/billing/subscriptions", () => ({ provisionSubscription: async () => {} }));

import { beginOnboardingCheckout } from "@/lib/billing/transactions";
import type { BillingAccount } from "@/lib/billing/accounts";

function account(franchise: boolean): BillingAccount {
  return {
    id: "billing", store_id: franchise ? null : "store", franchise_id: franchise ? "franchise" : null,
    owner_profile_id: "owner", status: "onboarding_due", onboarding_paid_at: null, grace_ends_at: null,
  };
}
beforeEach(() => {
  state.pending = null;
  state.inserted = [];
  state.charged = [];
  state.storeCount = 1;
});

it("includes each actual additional franchise store in the first month's checkout snapshot", async () => {
  state.storeCount = 3;
  await beginOnboardingCheckout(account(true), "owner@example.test", 900_000);
  expect(state.charged).toEqual([900_000]);
  expect(state.inserted[0]).toMatchObject({
    amount_cents: 900_000, initial_monthly_amount_cents: 450_000, initial_billable_store_count: 3,
  });
});

it.each([
  ["manager", false, 400_000, 150_000],
  ["franchise admin", true, 700_000, 250_000],
])("initializes the %s checkout with the full verified ledger amount", async (_label, franchise, total, monthly) => {
  await beginOnboardingCheckout(account(franchise), "owner@example.test", total);
  expect(state.charged).toEqual([total]);
  expect(state.inserted[0]).toMatchObject({
    amount_cents: total, initial_monthly_amount_cents: monthly, initial_billable_store_count: 1,
    purpose: "onboarding",
  });
  await beginOnboardingCheckout(account(franchise), "owner@example.test", total);
  expect(state.inserted).toHaveLength(1);
});

it("keeps an already initiated onboarding-only checkout at its original amount", async () => {
  state.pending = {
    id: "legacy", account_id: "billing", reference: "gc-onboard-legacy",
    payer_email: "owner@example.test", purpose: "onboarding", status: "pending",
    amount_cents: 450_000, initial_monthly_amount_cents: null, initial_billable_store_count: null,
  };
  await beginOnboardingCheckout(account(true), "owner@example.test", 450_000);
  expect(state.charged).toEqual([450_000]);
  expect(state.inserted).toHaveLength(0);
});

it("refuses a stale displayed amount and an already paid onboarding", async () => {
  await expect(beginOnboardingCheckout(account(false), "owner@example.test", 250_000)).rejects.toThrow(/amount changed/);
  expect(state.charged).toHaveLength(0);
  await expect(beginOnboardingCheckout({ ...account(false), onboarding_paid_at: "2026-10-21T10:00:00Z" }, "owner@example.test", 400_000)).rejects.toThrow(/already been completed/);
});
