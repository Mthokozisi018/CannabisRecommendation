import { describe, expect, it } from "vitest";
import { paymentError, paymentSchema } from "@/lib/pos-payment";
describe("POS money precision", () => {
  it("accepts decimal rand without floating-point mismatch", () => {
    expect(paymentError({ method: "split", cashAmount: 0.1, cardAmount: 0.2 }, 0.3)).toBeNull();
  });
  it("requires a payment choice and both recorded amounts", () => {
    expect(paymentSchema.safeParse(undefined).success).toBe(false);
    expect(paymentSchema.safeParse({ method: "split", cashAmount: 750 }).success).toBe(false);
    expect(paymentSchema.safeParse({ method: "other", cashAmount: 750, cardAmount: 0 }).success).toBe(false);
  });
  it("allows zero-total sales without inventing a tender", () => {
    expect(paymentError({ method: "cash", cashAmount: 0, cardAmount: 0 }, 0)).toBeNull();
  });
});
