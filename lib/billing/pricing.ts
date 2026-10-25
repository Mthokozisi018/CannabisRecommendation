export const BILLING_CURRENCY = "ZAR" as const;

export const BILLING_PRICES_CENTS = {
  independentOnboarding: 250_000,
  independentMonthly: 150_000,
  franchiseOnboarding: 450_000,
  franchiseBaseMonthly: 250_000,
  franchiseAdditionalStoreMonthly: 100_000,
} as const;

export function franchiseMonthlyPriceCents(billableStoreCount: number) {
  if (!Number.isSafeInteger(billableStoreCount) || billableStoreCount < 0) {
    throw new Error("Invalid billable store count.");
  }
  return BILLING_PRICES_CENTS.franchiseBaseMonthly
    + Math.max(billableStoreCount - 1, 0) * BILLING_PRICES_CENTS.franchiseAdditionalStoreMonthly;
}

export function initialBillingPriceCents(isFranchise: boolean, monthlyAmountCents: number) {
  if (!Number.isSafeInteger(monthlyAmountCents) || monthlyAmountCents <= 0) {
    throw new Error("Invalid monthly billing amount.");
  }
  const onboardingCents = isFranchise
    ? BILLING_PRICES_CENTS.franchiseOnboarding
    : BILLING_PRICES_CENTS.independentOnboarding;
  const totalCents = onboardingCents + monthlyAmountCents;
  if (!Number.isSafeInteger(totalCents)) throw new Error("Invalid initial billing amount.");
  return { onboardingCents, firstMonthCents: monthlyAmountCents, totalCents };
}

export function amountInRand(cents: number) {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error("Invalid billing amount.");
  return `R ${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)}`;
}

export function firstMonthlyBillingDate(paidAt: Date) {
  if (Number.isNaN(paidAt.valueOf())) throw new Error("Invalid onboarding payment date.");
  const year = paidAt.getUTCFullYear();
  const month = paidAt.getUTCMonth();
  const day = paidAt.getUTCDate();
  const finalDay = new Date(Date.UTC(year, month + 2, 0)).getUTCDate();
  return new Date(Date.UTC(year, month + 1, Math.min(day, finalDay), paidAt.getUTCHours(), paidAt.getUTCMinutes(), paidAt.getUTCSeconds()));
}
