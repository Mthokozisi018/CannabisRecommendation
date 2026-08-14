import { describe, expect, it } from "vitest";
import { getPOSProductCartDetails, getPOSProductImage } from "@/components/receptionist/pos/product-display";
import type { ReceptionistProduct } from "@/lib/receptionist/products";

function product(overrides: Partial<ReceptionistProduct>): ReceptionistProduct {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Test Product",
    categoryName: "Accessories",
    categorySlug: "accessories",
    subcategory: "Lighters",
    cultivationType: null,
    description: "",
    imageUrl: null,
    imagePath: null,
    sizeLabel: null,
    strainType: null,
    sellingPrice: 35,
    productStatus: "active",
    isVisibleOnPos: true,
    isActive: true,
    isNew: false,
    quantityAvailable: 6,
    lowStockThreshold: 2,
    ...overrides
  };
}

describe("POS product display details", () => {
  it("uses uploaded product images for cart snapshots", () => {
    const item = product({ imageUrl: "https://example.invalid/lighter.webp" });

    expect(getPOSProductImage(item)).toBe("https://example.invalid/lighter.webp");
    expect(getPOSProductCartDetails(item)).toMatchObject({
      name: "Test Product",
      categoryName: "Accessories",
      subcategory: "Lighters",
      imageSrc: "https://example.invalid/lighter.webp",
      unitPrice: 35,
      stockAvailable: 6
    });
  });

  it("matches pre-roll card imagery in the cart", () => {
    const item = product({
      categoryName: "Pre-Rolls",
      categorySlug: "pre-rolls",
      subcategory: "Single",
      cultivationType: "Indoor"
    });

    expect(getPOSProductImage(item)).toBe("/images/product-placeholders/pre-rolls/preroll-indoor.png");
    expect(getPOSProductCartDetails(item).imageSrc).toBe("/images/product-placeholders/pre-rolls/preroll-indoor.png");
  });
});
