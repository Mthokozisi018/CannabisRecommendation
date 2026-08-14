import type { ReceptionistProduct } from "@/lib/receptionist/products";
import { categoryAllowsCultivationType, CULTIVATION_TYPES, isProductCategory, PRODUCT_SUBCATEGORIES, VAPE_STRAIN_TYPES } from "@/lib/manager/options";
import type { ReceptionistCategory } from "@/lib/receptionist/products";
import type { CultivationOption } from "@/components/receptionist/pos/pos-types";

export function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function subcategoryKey(value: string) {
  return normalize(value).replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function cultivationKey(value: string | null | undefined) {
  return normalize(value ?? "").replace(/[^a-z0-9]+/g, "");
}

export const preferredSubcategoryOrder: Record<string, string[]> = {
  flower: ["Sativa", "Indica", "Hybrid"],
  "pre-rolls": ["Sativa", "Indica", "Hybrid"],
  "vape-cartridges": ["Vape Cartridge", "Disposable Vape"],
  edibles: [...PRODUCT_SUBCATEGORIES.Edibles],
  concentrates: ["Dab"],
  accessories: ["Lighters", "Grinders", "Grinders / Crushers", "Rolling Papers", "Storage Containers", "Storage / Jars", "Tray"]
};

const subcategoryLabels: Record<string, string> = {
  grinders: "Grinders / Crushers",
  "storage-containers": "Storage / Jars",
  storage: "Storage / Jars",
  jars: "Storage / Jars"
};

export const allowedCategorySlugs = new Set(["accessories", "concentrates", "edibles", "flower", "pre-rolls", "vape-cartridges", "disposable-vapes"]);

export function displaySubcategory(value: string) {
  return subcategoryLabels[subcategoryKey(value)] ?? value;
}

export function canAddProduct(product: ReceptionistProduct) {
  return Boolean(product.id && product.isActive && product.quantityAvailable > 0 && Number.isFinite(product.sellingPrice) && product.sellingPrice >= 0);
}

export function stockLabel(quantity: number) {
  if (quantity <= 0) return "Out of Stock";
  if (quantity <= 5) return "Low stock";
  return "In Stock";
}

export function isFlowerCategory(product: Pick<ReceptionistProduct, "categoryName" | "categorySlug">) {
  return product.categorySlug === "flower" || product.categoryName === "Flower";
}

export function isFlowerOrPreRollCategory(product: Pick<ReceptionistProduct, "categoryName" | "categorySlug">) {
  return isFlowerCategory(product) || product.categorySlug === "pre-rolls" || product.categoryName === "Pre-Rolls";
}

export function stockQuantityLabel(product: Pick<ReceptionistProduct, "categoryName" | "categorySlug" | "quantityAvailable">) {
  if (!Number.isFinite(product.quantityAvailable)) return "";
  return `${product.quantityAvailable} ${isFlowerCategory(product) ? "g" : "units"}`;
}

export function isStrainSubcategory(value?: string | null) {
  return value === "Sativa" || value === "Indica" || value === "Hybrid";
}

export function categoryUsesSecondaryFilter(category: Pick<ReceptionistCategory, "name" | "slug"> | null) {
  return Boolean(category && (categoryAllowsCultivationType(category.name) || category.slug === "vape-cartridges" || category.name === "Vape Cartridges"));
}

function secondaryFilterValues(category: Pick<ReceptionistCategory, "name" | "slug"> | null) {
  if (category?.slug === "vape-cartridges" || category?.name === "Vape Cartridges") return [...VAPE_STRAIN_TYPES];
  return [...CULTIVATION_TYPES];
}

export function getCultivationOptions(products: ReceptionistProduct[], selectedCategory: ReceptionistCategory | null, subcategory: string): CultivationOption[] {
  const selectedSubcategory = subcategoryKey(subcategory);
  const values = secondaryFilterValues(selectedCategory);

  return values.map((cultivationType) => {
    const count = selectedCategory && selectedSubcategory
      ? products.filter((product) => {
        const matchesCategory = product.categorySlug === selectedCategory.slug || normalize(product.categoryName) === normalize(selectedCategory.name);
        const matchesSubcategory = subcategoryKey(product.subcategory) === selectedSubcategory;
        const matchesCultivation = cultivationKey(product.cultivationType) === cultivationKey(cultivationType);
        return matchesCategory && matchesSubcategory && matchesCultivation;
      }).length
      : 0;

    return {
      label: cultivationType,
      value: cultivationType,
      count
    };
  });
}

export type ProductSelection = {
  category: string;
  subcategory: string;
  cultivationType: string;
};

function productMatchesCategory(product: ReceptionistProduct, category: ReceptionistCategory) {
  return product.categorySlug === category.slug || normalize(product.categoryName) === normalize(category.name);
}

function uniqueProductSubcategories(products: ReceptionistProduct[], category: ReceptionistCategory) {
  const values = new Map<string, string>();
  products.forEach((product) => {
    if (!productMatchesCategory(product, category) || !product.subcategory) return;
    const key = subcategoryKey(product.subcategory);
    if (!values.has(key)) values.set(key, product.subcategory);
  });
  return Array.from(values.values()).sort((a, b) => displaySubcategory(a).localeCompare(displaySubcategory(b)));
}

function orderedWithCurrent(values: readonly string[], currentValue: string) {
  if (!currentValue) return [...values];
  const currentKey = subcategoryKey(currentValue);
  const match = values.find((value) => subcategoryKey(value) === currentKey);
  if (!match) return [...values];
  return [match, ...values.filter((value) => subcategoryKey(value) !== currentKey)];
}

function orderedSecondaryWithCurrent(values: readonly string[], currentValue: string) {
  if (!currentValue) return [...values];
  const currentKey = cultivationKey(currentValue);
  const match = values.find((value) => cultivationKey(value) === currentKey);
  if (!match) return [...values];
  return [match, ...values.filter((value) => cultivationKey(value) !== currentKey)];
}

export function resolveProductSelection({
  products,
  categories,
  current,
  preferredCategorySlug = "flower"
}: {
  products: ReceptionistProduct[];
  categories: ReceptionistCategory[];
  current: Partial<ProductSelection>;
  preferredCategorySlug?: string;
}): ProductSelection | null {
  if (products.length === 0 || categories.length === 0) return null;

  const categoryMap = new Map(categories.map((category) => [category.slug, category]));
  const currentCategory = current.category ? categories.find((category) => category.slug === current.category || normalize(category.name) === normalize(current.category ?? "")) ?? null : null;
  const preferredCategory = categoryMap.get(preferredCategorySlug) ?? null;
  const categoryCandidates = [
    ...(currentCategory ? [currentCategory] : []),
    ...(preferredCategory && preferredCategory.slug !== currentCategory?.slug ? [preferredCategory] : []),
    ...categories.filter((category) => category.slug !== currentCategory?.slug && category.slug !== preferredCategory?.slug)
  ];

  for (const candidate of categoryCandidates) {
    const categoryProducts = products.filter((product) => productMatchesCategory(product, candidate));
    if (categoryProducts.length === 0) continue;

    const configuredSubcategories = isProductCategory(candidate.name) ? PRODUCT_SUBCATEGORIES[candidate.name] : null;
    const availableSubcategoryKeys = new Set(categoryProducts.map((product) => subcategoryKey(product.subcategory)).filter(Boolean));
    const subcategories = (configuredSubcategories ? configuredSubcategories.filter((item) => availableSubcategoryKeys.has(subcategoryKey(item))) : uniqueProductSubcategories(products, candidate));
    const subcategoryCandidates = orderedWithCurrent(subcategories, candidate.slug === currentCategory?.slug ? current.subcategory ?? "" : "");

    for (const subcategory of subcategoryCandidates) {
      const subcategoryProducts = categoryProducts.filter((product) => subcategoryKey(product.subcategory) === subcategoryKey(subcategory));
      if (subcategoryProducts.length === 0) continue;

      if (!categoryUsesSecondaryFilter(candidate)) {
        return { category: candidate.slug, subcategory, cultivationType: "" };
      }

      const values = secondaryFilterValues(candidate);
      const cultivationCandidates = orderedSecondaryWithCurrent(values, candidate.slug === currentCategory?.slug ? current.cultivationType ?? "" : "");
      const cultivationType = cultivationCandidates.find((item) => subcategoryProducts.some((product) => cultivationKey(product.cultivationType) === cultivationKey(item)));
      if (cultivationType) return { category: candidate.slug, subcategory, cultivationType };
    }
  }

  return null;
}
