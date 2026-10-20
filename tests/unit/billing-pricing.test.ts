import { expect, it } from "vitest";
import { BILLING_PRICES_CENTS, firstMonthlyBillingDate, franchiseMonthlyPriceCents } from "@/lib/billing/pricing";

it("calculates the confirmed ZAR amounts in integer minor units", () => {
  expect(BILLING_PRICES_CENTS.independentOnboarding).toBe(250_000);
  expect(BILLING_PRICES_CENTS.independentMonthly).toBe(150_000);
  expect(BILLING_PRICES_CENTS.franchiseOnboarding).toBe(450_000);
  expect([1, 2, 3, 4, 5].map(franchiseMonthlyPriceCents)).toEqual([230_000, 330_000, 430_000, 530_000, 630_000]);
  expect(franchiseMonthlyPriceCents(0)).toBe(230_000);
  expect(() => franchiseMonthlyPriceCents(-1)).toThrow();
});

it("schedules the first monthly debit one month after verified onboarding", () => {
  expect(firstMonthlyBillingDate(new Date("2026-01-31T10:30:00Z")).toISOString()).toBe("2026-02-28T10:30:00.000Z");
  expect(firstMonthlyBillingDate(new Date("2026-06-10T09:00:00Z")).toISOString()).toBe("2026-07-10T09:00:00.000Z");
});
