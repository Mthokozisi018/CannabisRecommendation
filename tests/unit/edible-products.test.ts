import { describe, expect, it } from "vitest";
import { formatEdibleMg, resolveProductModularKind } from "@/components/receptionist/pos/ProductDescriptionModal";
import { PRODUCT_SUBCATEGORIES } from "@/lib/manager/options";
import { productEditSchema, productFormSchema } from "@/lib/manager/validation";
import type { ReceptionistProduct } from "@/lib/receptionist/products";

const edibleProduct: ReceptionistProduct = {
  id: "product-1",
  name: "Berry Bites",
  categoryName: "Edibles",
  categorySlug: "edibles",
  subcategory: "Gummies",
  cultivationType: null,
  description: "",
  thcPerUnitMg: 5.5,
  thcPerPacketMg: 55,
  imageUrl: null,
  imagePath: null,
  sizeLabel: null,
  strainType: null,
  sellingPrice: 80,
  productStatus: "active",
  isActive: true,
  isNew: false,
  quantityAvailable: 10,
  lowStockThreshold: 2
};

describe("edible product configuration", () => {
  it("keeps the exact edible subcategory order in the central configuration", () => {
    expect(PRODUCT_SUBCATEGORIES.Edibles).toEqual(["Gummies", "Chocolates", "Cookies", "Brownies", "Drinks"]);
    expect(PRODUCT_SUBCATEGORIES.Edibles).not.toContain("Baked Goods");
  });

  it("creates edible products without a description when both THC amounts are valid", () => {
    const result = productFormSchema.safeParse({
      productName: "Berry Bites",
      category: "Edibles",
      subcategory: "Gummies",
      thcPerUnitMg: "5.5",
      thcPerPacketMg: "55",
      price: "80",
      productStatus: "active",
      initialStockQuantity: 0,
      lowStockThreshold: 5
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).not.toHaveProperty("description");
  });

  it("requires both edible THC amounts and rejects negative values", () => {
    const missingPacket = productFormSchema.safeParse({ ...edibleProduct, productName: edibleProduct.name, category: "Edibles", price: "80", productStatus: "active", initialStockQuantity: 0, lowStockThreshold: 5, thcPerPacketMg: "" });
    const negativeUnit = productFormSchema.safeParse({ ...edibleProduct, productName: edibleProduct.name, category: "Edibles", price: "80", productStatus: "active", initialStockQuantity: 0, lowStockThreshold: 5, thcPerUnitMg: "-1" });

    expect(missingPacket.success).toBe(false);
    expect(negativeUnit.success).toBe(false);
  });

  it("omits edible-only values from non-edible product submissions", () => {
    const result = productFormSchema.safeParse({
      productName: "Apollo",
      category: "Flower",
      subcategory: "Sativa",
      cultivationType: "Indoor",
      thcPerUnitMg: "5",
      thcPerPacketMg: "50",
      price: "120",
      productStatus: "active",
      initialStockQuantity: 0,
      lowStockThreshold: 5
    });

    expect(result.success).toBe(false);
  });

  it("validates THC values on edible edits", () => {
    expect(productEditSchema.safeParse({
      productId: "10000000-0000-4000-8000-000000000001",
      category: "Edibles",
      subcategory: "Cookies",
      productName: "Cookie Bites",
      thcPerUnitMg: "10",
      thcPerPacketMg: "100.5",
      price: "95",
      productStatus: "active"
    }).success).toBe(true);
  });

  it("selects one edible modular for all edible subcategories and formats missing legacy values safely", () => {
    for (const subcategory of PRODUCT_SUBCATEGORIES.Edibles) {
      expect(resolveProductModularKind({ ...edibleProduct, subcategory })).toBe("edible");
    }
    expect(formatEdibleMg(null)).toBe("--");
    expect(formatEdibleMg(undefined)).toBe("--");
  });
});
