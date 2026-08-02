import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProductCard } from "@/components/receptionist/pos/ProductCard";
import type { ReceptionistProduct } from "@/lib/receptionist/products";

vi.mock("@/app/actions", () => ({ logoutGreenChoiceStaffAction: vi.fn() }));

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const product: ReceptionistProduct = {
  id: "product-1",
  name: "Test Product",
  categoryName: "Accessories",
  categorySlug: "accessories",
  subcategory: "Lighters",
  cultivationType: null,
  description: "",
  thcPerUnitMg: null,
  thcPerPacketMg: null,
  imageUrl: "/lighter.png",
  imagePath: null,
  sizeLabel: "1 unit",
  strainType: null,
  sellingPrice: 30,
  productStatus: "active",
  isActive: true,
  isNew: false,
  quantityAvailable: 8,
  lowStockThreshold: 2
};

describe("Receptionist POS click feedback", () => {
  it("makes the product card an accessible click target while isolating nested buttons", () => {
    const markup = renderToStaticMarkup(createElement(ProductCard, { product, onAddToCart: () => undefined, onOpenDescription: () => undefined }));
    const card = source("components/receptionist/pos/ProductCard.tsx");

    expect(markup).toContain('role="button"');
    expect(markup).toContain('tabindex="0"');
    expect(markup).toContain(`aria-label="View ${product.name} information"`);
    expect(card).toContain("event.stopPropagation()");
    expect(card).toContain("onKeyDown={handleCardKeyDown}");
    expect(card).toContain("touch-manipulation");
    expect(card).toContain('{addFeedback ? "Added" : "Add to cart"}');
  });

  it("uses one non-blocking notification slot with auto-dismiss timers", () => {
    const pos = source("components/receptionist/pos/ReceptionistPOS.tsx");

    expect(pos).toContain("Product added to cart");
    expect(pos).toContain("Sale completed");
    expect(pos).toContain("ADD_TO_CART_FEEDBACK_MS = 3200");
    expect(pos).toContain("SALE_COMPLETE_FEEDBACK_MS = 30_000");
    expect(pos).toContain("setNotice((current) => (current?.id === notice.id ? null : current))");
    expect(pos).toContain("pointer-events-none fixed");
    expect(pos).toContain('aria-label="Close message"');
  });

  it("guards accidental duplicate Add to Cart taps and enlarges checkout affordances", () => {
    const pos = source("components/receptionist/pos/ReceptionistPOS.tsx");
    const cart = source("components/receptionist/pos/CartPanel.tsx");

    expect(pos).toContain("ADD_TO_CART_DUPLICATE_GUARD_MS = 450");
    expect(pos).toContain("recentAddClicksRef");
    expect(pos).toContain("if (now - recentAddAt < ADD_TO_CART_DUPLICATE_GUARD_MS) return");
    expect(pos).toContain("size-16");
    expect(pos).toContain("sm:size-[4.5rem]");
    expect(pos).not.toContain("Ready for sale");
    expect(cart).toContain("min-h-16");
    expect(cart).toContain("text-lg font-extrabold");
    expect(cart).toContain("aria-busy={isPending}");
    expect(cart).toContain("Processing checkout...");
  });
});
