import { describe, expect, it } from "vitest";
import { addStockProductSchema, addStockReceiptSchema } from "@/lib/manager/add-stock-validation";

const receipt = { category: "Accessories", subcategory: "Lighters", productId: "10000000-0000-4000-8000-000000000001", quantityToAdd: "2", supplierId: "20000000-0000-4000-8000-000000000001", supplierUnitCost: "12.50", cultivationType: "" };
describe("Add Stock workflow validation", () => {
  it.each(["Flower", "Pre-Rolls"])("requires applicable classification for %s", (category) => {
    expect(addStockReceiptSchema.safeParse({ ...receipt, category, subcategory: "Sativa", cultivationType: "Indoor" }).success).toBe(true);
    expect(addStockReceiptSchema.safeParse({ ...receipt, category, subcategory: "Sativa" }).success).toBe(false);
  });
  it.each([["Edibles", "Gummies"], ["Vape Cartridges", "Vape Cartridge"], ["Concentrates", "Dab"], ["Accessories", "Lighters"]])("rejects stale classification for %s", (category, subcategory) => {
    expect(addStockReceiptSchema.safeParse({ ...receipt, category, subcategory }).success).toBe(true);
    expect(addStockReceiptSchema.safeParse({ ...receipt, category, subcategory, cultivationType: "Indoor" }).success).toBe(false);
  });
  it("supports receipts for legacy vape records without requiring hidden strain input", () => {
    expect(addStockReceiptSchema.safeParse({ ...receipt, category: "Vape Cartridges", subcategory: "Sativa" }).success).toBe(true);
  });
  it("rejects an unknown category without throwing", () => {
    expect(addStockReceiptSchema.safeParse({ ...receipt, category: "Unknown" }).success).toBe(false);
  });
  it.each([{ supplierId: "" }, { supplierUnitCost: "" }, { supplierUnitCost: "-1" }, { supplierUnitCost: "12.555" }, { quantityToAdd: "0" }, { quantityToAdd: "1.5" }])("rejects invalid receipt %o", (invalid) => {
    expect(addStockReceiptSchema.safeParse({ ...receipt, ...invalid }).success).toBe(false);
  });
  it("keeps edible THC validation and allows new vapes without strain", () => {
    const product = { ...receipt, productName: "Test", price: "20", initialStockQuantity: "2", productStatus: "active", lowStockThreshold: 5 };
    const missingThc = addStockProductSchema.safeParse({ ...product, category: "Edibles", subcategory: "Gummies" });
    expect(missingThc.success).toBe(false);
    if (!missingThc.success) {
      expect(missingThc.error.issues.map((issue) => issue.path.join("."))).toEqual(
        expect.arrayContaining(["thcPerUnitMg", "thcPerPacketMg"])
      );
    }
    expect(addStockProductSchema.safeParse({ ...product, category: "Edibles", subcategory: "Gummies", thcPerUnitMg: "5", thcPerPacketMg: "20" }).success).toBe(true);
    expect(addStockProductSchema.safeParse({ ...product, category: "Vape Cartridges", subcategory: "Vape Cartridge" }).success).toBe(true);
  });
});
