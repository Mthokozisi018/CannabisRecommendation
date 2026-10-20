import { z } from "zod";

export const paymentSchema = z.object({
  method: z.enum(["cash", "card", "split"]),
  cashAmount: z.number().finite().nonnegative(),
  cardAmount: z.number().finite().nonnegative()
});
export type POSPayment = z.infer<typeof paymentSchema>;

// Compare integer cents, never floating-point sums of rand amounts.
export function amountInCents(value: number): number | null {
  const cents = Math.round(value * 100);
  return Number.isFinite(value) && value >= 0 && Number.isSafeInteger(cents) &&
    Math.abs(value * 100 - cents) < 0.000001 ? cents : null;
}

export function paymentError(payment: POSPayment, total: number): string | null {
  const cash = amountInCents(payment.cashAmount);
  const card = amountInCents(payment.cardAmount);
  const due = amountInCents(total);
  if (cash === null || card === null || due === null) return "Enter valid amounts with at most two decimal places.";
  if (cash > due || card > due) return "Payment amounts cannot exceed the sale total.";
  if (cash + card !== due) return "Cash and card amounts must add up exactly to the sale total.";
  if (payment.method === "cash" && card !== 0) return "Cash payments must record the full total as cash.";
  if (payment.method === "card" && cash !== 0) return "Card payments must record the full total as card.";
  return null;
}
