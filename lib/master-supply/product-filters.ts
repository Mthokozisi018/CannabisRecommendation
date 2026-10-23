import { displaySubcategory, subcategoryKey } from "@/components/receptionist/pos/pos-helpers";
import { PRODUCT_SUBCATEGORIES, type ProductCategory } from "@/lib/manager/options";
import type { MasterProduct } from "./data";

export const SUPPLY_CATEGORIES = [
  { category: "Flower", label: "Flower" },
  { category: "Pre-Rolls", label: "Pre-Rolls" },
  { category: "Edibles", label: "Edibles" },
  { category: "Accessories", label: "Accessories" },
  { category: "Concentrates", label: "Concentrates" },
  { category: "Vape Cartridges", label: "Vape Cartridges / Disposables" },
] as const satisfies readonly { category: ProductCategory; label: string }[];

export type SupplyCategory = (typeof SUPPLY_CATEGORIES)[number]["category"];

export function supplyCategoryFor(category: string) {
  return category === "Disposable Vapes" ? "Vape Cartridges" : category;
}

type FilterProduct = Pick<MasterProduct, "name" | "sku" | "category" | "subcategory" | "strain_type" | "cultivation_type">;

export function supplySubcategories(products: FilterProduct[], category: SupplyCategory) {
  const registered = new Map<string, string>();
  for (const product of products) {
    if (supplyCategoryFor(product.category) !== category || !product.subcategory.trim()) continue;
    const key = subcategoryKey(product.subcategory);
    if (!registered.has(key)) registered.set(key, product.subcategory);
  }
  const preferred = category === "Vape Cartridges"
    ? [...PRODUCT_SUBCATEGORIES["Vape Cartridges"], ...PRODUCT_SUBCATEGORIES["Disposable Vapes"]]
    : [...PRODUCT_SUBCATEGORIES[category]];
  const order = preferred.map(subcategoryKey);
  return [...registered.values()].sort((a, b) => {
    const aIndex = order.indexOf(subcategoryKey(a));
    const bIndex = order.indexOf(subcategoryKey(b));
    const aRank = aIndex < 0 ? Infinity : aIndex;
    const bRank = bIndex < 0 ? Infinity : bIndex;
    return aRank === bRank ? displaySubcategory(a).localeCompare(displaySubcategory(b)) : aRank - bRank;
  });
}

export type SupplyProductFilters = {
  category: SupplyCategory;
  search: string;
  subcategory: string;
  strain: string;
  cultivation: string;
};

export function filterSupplyProducts<T extends FilterProduct>(products: T[], filters: SupplyProductFilters) {
  const search = filters.search.trim().toLowerCase();
  return products.filter(product =>
    supplyCategoryFor(product.category) === filters.category
    && (!search || `${product.name} ${product.sku}`.toLowerCase().includes(search))
    && (!filters.subcategory || subcategoryKey(product.subcategory) === subcategoryKey(filters.subcategory))
    && (!filters.strain || subcategoryKey(product.strain_type || product.subcategory) === subcategoryKey(filters.strain))
    && (filters.category !== "Flower" || !filters.cultivation || product.cultivation_type === filters.cultivation)
  );
}
