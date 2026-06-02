import { describe, expect, it } from "vitest";
import { addToCartSchema } from "@/lib/schemas/cart";
import { verifyCsrfToken, signCsrfToken } from "@/lib/security";

describe("protected mutation helpers", () => {
  it("validates cart payloads", () => {
    const parsed = addToCartSchema.parse({ productId: "30000000-0000-4000-8000-000000000001", quantity: "2" });
    expect(parsed.quantity).toBe(2);
  });

  it("verifies csrf signatures", () => {
    const token = "local-token";
    expect(verifyCsrfToken(token, signCsrfToken(token))).toBe(true);
    expect(verifyCsrfToken(token, signCsrfToken("other"))).toBe(false);
  });
});
