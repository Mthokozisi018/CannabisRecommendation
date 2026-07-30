import { describe, expect, it } from "vitest";
import { inventoryAddSchema, productFormSchema } from "@/lib/manager/validation";

describe("vape Add Stock category structure", () => {
  it("requires a vape subcategory and strain type for Vape Cartridges products", () => {
    expect(productFormSchema.safeParse({
      productName: "Disposable Dream",
      category: "Vape Cartridges",
      subcategory: "Disposable Vape",
      cultivationType: "Hybrid",
      price: "350",
      productStatus: "active",
      initialStockQuantity: 0,
      lowStockThreshold: 5
    }).success).toBe(true);

    expect(productFormSchema.safeParse({
      productName: "Disposable Dream",
      category: "Vape Cartridges",
      subcategory: "Disposable Vape",
      cultivationType: "",
      price: "350",
      productStatus: "active",
      initialStockQuantity: 0,
      lowStockThreshold: 5
    }).success).toBe(false);
  });

  it("allows stock additions for selected vape subtype and strain", () => {
    const result = inventoryAddSchema.safeParse({
      category: "Vape Cartridges",
      subcategory: "Vape Cartridge",
      cultivationType: "Sativa",
      productId: "10000000-0000-4000-8000-000000000001",
      quantityToAdd: "4"
    });

    expect(result.success).toBe(true);
  });
});
