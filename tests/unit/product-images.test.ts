import { describe, expect, it } from "vitest";
import { getFlowerCultivationPlaceholder, getPreRollCultivationCardImage, getProductImage } from "@/lib/product-images";

describe("product image placeholders", () => {
  it("maps Flower cultivation types to dedicated placeholders", () => {
    expect(getFlowerCultivationPlaceholder("Indoor")).toBe("/images/flower-placeholders/indoor.png");
    expect(getFlowerCultivationPlaceholder(" greenhouse ")).toBe("/images/flower-placeholders/greenhouse.png");
    expect(getFlowerCultivationPlaceholder("OUTDOOR")).toBe("/images/flower-placeholders/outdoor.png");
  });

  it("returns null for unknown cultivation types", () => {
    expect(getFlowerCultivationPlaceholder(null)).toBeNull();
    expect(getFlowerCultivationPlaceholder("")).toBeNull();
    expect(getFlowerCultivationPlaceholder("Hydro")).toBeNull();
  });

  it("uses uploaded product images before Flower cultivation placeholders", () => {
    expect(getProductImage({ image_url: " https://example.com/flower.png ", category: "Flower", cultivationType: "Indoor" })).toBe("https://example.com/flower.png");
  });

  it("uses Flower cultivation placeholders when no uploaded image exists", () => {
    expect(getProductImage({ category: "Flower", cultivationType: "Indoor" })).toBe("/images/flower-placeholders/indoor.png");
    expect(getProductImage({ categoryName: " flower ", cultivation_type: "Greenhouse" })).toBe("/images/flower-placeholders/greenhouse.png");
    expect(getProductImage({ categorySlug: "flower", growType: "outdoor" })).toBe("/images/flower-placeholders/outdoor.png");
  });

  it("maps Pre-Rolls cultivation types to their product card images", () => {
    expect(getPreRollCultivationCardImage({ category: "Pre-Rolls", cultivationType: "Indoor" })).toBe("/images/product-placeholders/pre-rolls/preroll-indoor.png");
    expect(getPreRollCultivationCardImage({ categoryName: " pre rolls ", cultivation_type: "Greenhouse" })).toBe("/images/product-placeholders/pre-rolls/preroll-greenhouse.png");
    expect(getPreRollCultivationCardImage({ categorySlug: "pre-rolls", growType: "outdoor" })).toBe("/images/product-placeholders/pre-rolls/preroll-outdoor.png");
  });

  it("keeps the existing card fallback for invalid Pre-Rolls cultivation types", () => {
    expect(getPreRollCultivationCardImage({ category: "Pre-Rolls", cultivationType: null })).toBeNull();
    expect(getPreRollCultivationCardImage({ category: "Pre-Rolls", cultivationType: "Hydro" })).toBeNull();
    expect(getProductImage({ category: "Pre-Rolls", cultivationType: "Hydro" })).toBe("/placeholder-images/PreRolls.png");
  });

  it("does not apply Pre-Rolls card images to any other category", () => {
    for (const category of ["Flower", "Vape Cartridges", "Edibles", "Concentrates", "Accessories"]) {
      expect(getPreRollCultivationCardImage({ category, cultivationType: "Indoor" })).toBeNull();
    }
  });

  it("keeps existing fallback behavior for non-Flower products", () => {
    expect(getProductImage({ category: "Pre-Rolls", cultivationType: "Indoor" })).toBe("/placeholder-images/PreRolls.png");
    expect(getProductImage({ category: "Vape Cartridges", cultivationType: "Outdoor" })).toBe("/placeholder-images/Vape Cartige .png");
    expect(getProductImage({ category: "Edibles", subcategory: "Gummies" })).toBe("/placeholder-images/gummies.png");
  });
});
