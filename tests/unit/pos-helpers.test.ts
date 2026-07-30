import { describe, expect, it } from "vitest";
import { getCultivationOptions, resolveProductSelection, stockQuantityLabel } from "@/components/receptionist/pos/pos-helpers";
import type { ReceptionistCategory, ReceptionistProduct } from "@/lib/receptionist/products";
import { categoryButtonOrder, PRODUCT_CATEGORY_BUTTON_ORDER } from "@/lib/manager/options";

const category: ReceptionistCategory = {
  name: "Flower",
  slug: "flower",
  count: 4
};

const baseProduct: ReceptionistProduct = {
  id: "product-1",
  name: "Apollo",
  categoryName: "Flower",
  categorySlug: "flower",
  subcategory: "Hybrid",
  cultivationType: "Indoor",
  description: "",
  imageUrl: null,
  imagePath: null,
  sizeLabel: null,
  strainType: null,
  sellingPrice: 120,
  productStatus: "active",
  isActive: true,
  isNew: false,
  quantityAvailable: 99,
  lowStockThreshold: 5
};

describe("POS helpers", () => {
  it("uses the shared category button order", () => {
    expect(PRODUCT_CATEGORY_BUTTON_ORDER).toEqual(["Flower", "Pre-Rolls", "Edibles", "Accessories", "Vape Cartridges"]);
    expect(["Vape Cartridges", "Accessories", "Edibles", "Pre-Rolls", "Flower"].sort((a, b) => categoryButtonOrder(a) - categoryButtonOrder(b)))
      .toEqual(["Flower", "Pre-Rolls", "Edibles", "Accessories", "Vape Cartridges"]);
  });

  it("prefers Flower and resolves to a filter combination with products", () => {
    const selection = resolveProductSelection({
      products: [
        { ...baseProduct, id: "edible", categoryName: "Edibles", categorySlug: "edibles", subcategory: "Gummies", cultivationType: null },
        { ...baseProduct, id: "flower", subcategory: "Sativa", cultivationType: "Indoor" }
      ],
      categories: [
        { name: "Edibles", slug: "edibles", count: 1 },
        { name: "Flower", slug: "flower", count: 1 }
      ],
      current: {}
    });

    expect(selection).toEqual({ category: "flower", subcategory: "Sativa", cultivationType: "Indoor" });
  });

  it("falls back when the current filter combination has no products", () => {
    const selection = resolveProductSelection({
      products: [
        { ...baseProduct, id: "sativa-indoor", subcategory: "Sativa", cultivationType: "Indoor" },
        { ...baseProduct, id: "hybrid-outdoor", subcategory: "Hybrid", cultivationType: "Outdoor" }
      ],
      categories: [category],
      current: { category: "flower", subcategory: "Sativa", cultivationType: "Greenhouse" }
    });

    expect(selection).toEqual({ category: "flower", subcategory: "Sativa", cultivationType: "Indoor" });
  });
  it("counts cultivation products for the selected category and subcategory", () => {
    const options = getCultivationOptions([
      { ...baseProduct, id: "hybrid-greenhouse", cultivationType: "greenhouse", quantityAvailable: 20 },
      { ...baseProduct, id: "hybrid-outdoor", cultivationType: "Outdoor", quantityAvailable: 1 },
      { ...baseProduct, id: "sativa-indoor", subcategory: "Sativa", cultivationType: "Indoor", quantityAvailable: 50 },
      { ...baseProduct, id: "edible-indoor", categoryName: "Edibles", categorySlug: "edibles", subcategory: "Gummies", cultivationType: "Indoor" }
    ], category, "Hybrid");

    expect(options).toEqual([
      { label: "Indoor", value: "Indoor", count: 0 },
      { label: "Greenhouse", value: "Greenhouse", count: 1 },
      { label: "Outdoor", value: "Outdoor", count: 1 }
    ]);
  });

  it("resolves Vape Cartridges to disposable subtype before strain", () => {
    const product = {
      ...baseProduct,
      id: "disposable-indica",
      categoryName: "Vape Cartridges",
      categorySlug: "vape-cartridges",
      subcategory: "Disposable Vape",
      cultivationType: "Indica"
    };
    const selection = resolveProductSelection({
      products: [product],
      categories: [{ name: "Vape Cartridges", slug: "vape-cartridges", count: 1 }],
      current: { category: "vape-cartridges" },
      preferredCategorySlug: "vape-cartridges"
    });
    const strainOptions = getCultivationOptions([product], { name: "Vape Cartridges", slug: "vape-cartridges", count: 1 }, "Disposable Vape");

    expect(selection).toEqual({ category: "vape-cartridges", subcategory: "Disposable Vape", cultivationType: "Indica" });
    expect(strainOptions).toEqual([
      { label: "Sativa", value: "Sativa", count: 0 },
      { label: "Indica", value: "Indica", count: 1 },
      { label: "Hybrid", value: "Hybrid", count: 0 }
    ]);
  });

  it("displays Flower stock in grams and Pre-Roll stock in units", () => {
    expect(stockQuantityLabel({ ...baseProduct, categoryName: "Flower", categorySlug: "flower", quantityAvailable: 50 })).toBe("50 g");
    expect(stockQuantityLabel({ ...baseProduct, categoryName: "Flower", categorySlug: "flower", quantityAvailable: 0 })).toBe("0 g");
    expect(stockQuantityLabel({ ...baseProduct, categoryName: "Pre-Rolls", categorySlug: "pre-rolls", quantityAvailable: 50 })).toBe("50 units");
  });
});
