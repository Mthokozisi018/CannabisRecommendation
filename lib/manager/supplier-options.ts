import { CULTIVATION_TYPES, PRODUCT_SUBCATEGORIES, type ProductCategory } from "@/lib/manager/options";

export const SUPPLIER_CATEGORIES = ["Flower", "Pre-Rolls", "Edibles", "Vape Cartridges", "Concentrates", "Accessories"] as const satisfies readonly ProductCategory[];

export function supplierCategoryLabel(category: string) {
  return category === "Vape Cartridges" ? "Vape" : category;
}

export function supplierSubcategories(category: ProductCategory) {
  if (category === "Flower" || category === "Pre-Rolls") return [...CULTIVATION_TYPES];
  return [...PRODUCT_SUBCATEGORIES[category]];
}

export function supplierSubcategoryForProduct(category: string, subcategory: string, cultivationType: string) {
  return category === "Flower" || category === "Pre-Rolls" ? cultivationType : subcategory;
}
