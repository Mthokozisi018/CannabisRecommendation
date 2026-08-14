import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { addToCartSchema, importPayloadSchema } from "@/lib/schemas/cart";
import { productImportRowSchema, storeSwitchSchema } from "@/lib/schemas/shared";
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
    expect(verifyCsrfToken(token, "bad")).toBe(false);
  });

  it("rejects unknown cart and store switch fields", () => {
    expect(() => addToCartSchema.parse({
      productId: "30000000-0000-4000-8000-000000000001",
      quantity: 1,
      storeId: "30000000-0000-4000-8000-000000000002",
      unitPriceCents: 1
    })).toThrow();
    expect(() => storeSwitchSchema.parse({
      storeId: "30000000-0000-4000-8000-000000000002",
      role: "admin"
    })).toThrow();
  });

  it("rejects hidden import and product privilege fields", () => {
    expect(() => importPayloadSchema.parse({ mode: "dry_run", json: "{}", actorUserId: "admin" })).toThrow();
    expect(() => productImportRowSchema.parse({
      slug: "blue-dream",
      categorySlug: "flower",
      subcategorySlug: "hybrid",
      name: "Blue Dream",
      description: "A valid informational product description.",
      priceCents: 12000,
      effects: [{ slug: "relaxed", scorePct: 80 }],
      storeId: "30000000-0000-4000-8000-000000000002",
      createdByUserId: "30000000-0000-4000-8000-000000000003"
    })).toThrow();
  });
});
