import { expect, it } from "vitest";
import { amountInRand, BILLING_PRICES_CENTS, firstMonthlyBillingDate, franchiseMonthlyPriceCents, initialBillingPriceCents } from "@/lib/billing/pricing";

it("calculates the confirmed ZAR amounts in integer minor units", () => {
  expect(BILLING_PRICES_CENTS.independentOnboarding).toBe(250_000);
  expect(BILLING_PRICES_CENTS.independentMonthly).toBe(150_000);
  expect(BILLING_PRICES_CENTS.franchiseOnboarding).toBe(450_000);
  expect([1, 2, 3, 4, 5].map(franchiseMonthlyPriceCents)).toEqual([250_000, 350_000, 450_000, 550_000, 650_000]);
  expect(franchiseMonthlyPriceCents(0)).toBe(250_000);
  expect(() => franchiseMonthlyPriceCents(-1)).toThrow();
});

it("adds the first month to each new account's initial payment", () => {
  expect(initialBillingPriceCents(false, 150_000)).toEqual({ onboardingCents: 250_000, firstMonthCents: 150_000, totalCents: 400_000 });
  expect(initialBillingPriceCents(true, franchiseMonthlyPriceCents(1)).totalCents).toBe(700_000);
  expect(initialBillingPriceCents(true, franchiseMonthlyPriceCents(3)).totalCents).toBe(900_000);
});

it("displays billing amounts with an explicit Rand symbol", () => {
  expect(amountInRand(700_000)).toBe("R 7,000.00");
  expect(amountInRand(400_000)).toBe("R 4,000.00");
});

it("schedules the next monthly debit one month after the initial payment", () => {
  expect(firstMonthlyBillingDate(new Date("2026-01-31T10:30:00Z")).toISOString()).toBe("2026-02-28T10:30:00.000Z");
  expect(firstMonthlyBillingDate(new Date("2026-06-10T09:00:00Z")).toISOString()).toBe("2026-07-10T09:00:00.000Z");
});
