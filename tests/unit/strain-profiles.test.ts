import { describe, expect, it } from "vitest";
import { productEditSchema, productFormSchema } from "@/lib/manager/validation";
import { getStaticStrainProfileForProduct, isStaticStrainDescriptionProduct } from "@/lib/strain-profiles";

describe("static strain profile matching", () => {
  it("matches strain products with safe category and subcategory normalization", () => {
    expect(isStaticStrainDescriptionProduct({ categoryName: " flower ", subcategory: "sativa" })).toBe(true);
    expect(isStaticStrainDescriptionProduct({ categoryName: "Pre Rolls", subcategory: "INDICA" })).toBe(true);
    expect(isStaticStrainDescriptionProduct({ categoryName: "Vape Cartridges", subcategory: " Hybrid " })).toBe(true);
  });

  it("does not replace manager descriptions for non-strain products", () => {
    expect(isStaticStrainDescriptionProduct({ categoryName: "Edibles", subcategory: "Gummies" })).toBe(false);
    expect(isStaticStrainDescriptionProduct({ categoryName: "Accessories", subcategory: "Lighters" })).toBe(false);
    expect(isStaticStrainDescriptionProduct({ categoryName: "Flower", subcategory: "Outdoor" })).toBe(false);
  });

  it("returns the expected static profile content", () => {
    const profile = getStaticStrainProfileForProduct({ categoryName: "Vape Cartridges", subcategory: "Hybrid" });
    expect(profile?.title).toBe("Hybrid");
    expect(profile?.bestTime).toBe("Anytime");
    expect(profile?.effects.map((effect) => effect.label)).toEqual(["Balanced", "Uplifted", "Relaxed", "Focused", "Smooth"]);
  });

  it("uses explicit strain type before subcategory when provided", () => {
    expect(getStaticStrainProfileForProduct({ categoryName: "Flower", subcategory: "Sativa", strainType: "Indica" })?.title).toBe("Indica");
    expect(getStaticStrainProfileForProduct({ categoryName: "Pre-Rolls", subcategory: "Sativa", strainType: "Sativa Hybrid" })?.title).toBe("Hybrid");
  });
});

describe("manager product validation without descriptions", () => {
  it("does not require descriptions for create or edit", () => {
    expect(productFormSchema.safeParse({
      productName: "Apollo",
      category: "Flower",
      subcategory: "Sativa",
      cultivationType: "Indoor",
      price: "120",
      productStatus: "active",
      initialStockQuantity: 0,
      lowStockThreshold: 5
    }).success).toBe(true);

    expect(productEditSchema.safeParse({
      productId: "10000000-0000-4000-8000-000000000001",
      category: "Vape Cartridges",
      subcategory: "Vape Cartridge",
      cultivationType: "Hybrid",
      productName: "Apollo Cart",
      price: "250",
      productStatus: "active"
    }).success).toBe(true);
  });

  it("allows edible creation without a description when THC values are present", () => {
    expect(productFormSchema.safeParse({
      productName: "Berry Gummies",
      category: "Edibles",
      subcategory: "Gummies",
      thcPerUnitMg: "10",
      thcPerPacketMg: "100",
      price: "80",
      productStatus: "active",
      initialStockQuantity: 0,
      lowStockThreshold: 5
    }).success).toBe(true);
  });
});
