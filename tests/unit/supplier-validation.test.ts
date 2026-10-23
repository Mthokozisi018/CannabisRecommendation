import { describe, expect, it } from "vitest";
import { supplierFormSchema } from "@/lib/manager/supplier-validation";

const supplier = {
  name: "GreenLeaf Farms",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  status: "active" as const,
  categories: [
    { category: "Flower", subcategory: "Indoor" },
    { category: "Pre-Rolls", subcategory: "Outdoor" }
  ]
};

describe("supplier validation", () => {
  it("accepts multiple valid category mappings for one supplier", () => {
    expect(supplierFormSchema.safeParse(supplier).success).toBe(true);
  });

  it("rejects duplicate and category-incompatible mappings", () => {
    expect(supplierFormSchema.safeParse({ ...supplier, categories: [...supplier.categories, supplier.categories[0]] }).success).toBe(false);
    expect(supplierFormSchema.safeParse({ ...supplier, categories: [{ category: "Flower", subcategory: "Gummies" }] }).success).toBe(false);
  });

  it("does not validate or submit removed profile fields", () => {
    const parsed = supplierFormSchema.safeParse({
      ...supplier,
      description: "x".repeat(501),
      paymentTerms: "x".repeat(81),
      minimumOrderAmount: -1,
      deliveryTimeDays: "x".repeat(41),
      notes: "x".repeat(2001)
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("description");
      expect(parsed.data).not.toHaveProperty("paymentTerms");
      expect(parsed.data).not.toHaveProperty("minimumOrderAmount");
      expect(parsed.data).not.toHaveProperty("deliveryTimeDays");
      expect(parsed.data).not.toHaveProperty("notes");
    }
  });
});
