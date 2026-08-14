export const PRODUCT_CATEGORIES = [
  "Flower",
  "Pre-Rolls",
  "Edibles",
  "Accessories",
  "Vape Cartridges",
  "Disposable Vapes",
  "Concentrates",
  "Beverages"
] as const;

export const PRODUCT_CATEGORY_BUTTON_ORDER = ["Flower", "Pre-Rolls", "Edibles", "Accessories", "Vape Cartridges"] as const;

export const VAPE_PRODUCT_TYPES = ["Vape Cartridge", "Disposable Vape"] as const;
export const VAPE_STRAIN_TYPES = ["Sativa", "Indica", "Hybrid"] as const;

export const PRODUCT_SUBCATEGORIES = {
  Flower: ["Sativa", "Indica", "Hybrid"],
  "Vape Cartridges": ["Vape Cartridge", "Disposable Vape"],
  "Disposable Vapes": ["Sativa", "Indica", "Hybrid"],
  Edibles: ["Gummies", "Chocolates", "Cookies", "Brownies", "Drinks"],
  Concentrates: ["Dab"],
  "Pre-Rolls": ["Sativa", "Indica", "Hybrid"],
  Beverages: ["Soft Drinks", "Juices", "Water", "Energy Drinks"],
  Accessories: ["Lighters", "Rolling Papers", "Grinders", "Pipes", "Storage Containers", "Trays"]
} as const satisfies Record<ProductCategory, readonly string[]>;

export const CULTIVATION_TYPES = ["Indoor", "Greenhouse", "Outdoor"] as const;
export const PRODUCT_STATUSES = ["active", "inactive"] as const;
export const STAFF_ROLES = ["manager", "receptionist"] as const;
export const ACCOUNT_STATUSES = ["active", "deactivated", "deleted"] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];
export type CultivationType = (typeof CULTIVATION_TYPES)[number];
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
export type StaffRole = (typeof STAFF_ROLES)[number];
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];
export type StockQuantityType = "integer";

export type ProductCategoryParameters = {
  usesStrainType: boolean;
  usesCultivationType: boolean;
  allowProductImageOnCreate: boolean;
  allowProductImageOnEdit: boolean;
  stockUnit: "grams" | "units";
  stockDisplaySuffix: "g" | "units";
  stockQuantityType: StockQuantityType;
};

export const PRODUCT_CATEGORY_PARAMETERS = {
  Flower: {
    usesStrainType: true,
    usesCultivationType: true,
    allowProductImageOnCreate: false,
    allowProductImageOnEdit: false,
    stockUnit: "grams",
    stockDisplaySuffix: "g",
    stockQuantityType: "integer"
  },
  "Pre-Rolls": {
    usesStrainType: true,
    usesCultivationType: true,
    allowProductImageOnCreate: false,
    allowProductImageOnEdit: false,
    stockUnit: "units",
    stockDisplaySuffix: "units",
    stockQuantityType: "integer"
  },
  "Vape Cartridges": {
    usesStrainType: true,
    usesCultivationType: false,
    allowProductImageOnCreate: true,
    allowProductImageOnEdit: false,
    stockUnit: "units",
    stockDisplaySuffix: "units",
    stockQuantityType: "integer"
  },
  "Disposable Vapes": {
    usesStrainType: true,
    usesCultivationType: false,
    allowProductImageOnCreate: true,
    allowProductImageOnEdit: false,
    stockUnit: "units",
    stockDisplaySuffix: "units",
    stockQuantityType: "integer"
  },
  Edibles: {
    usesStrainType: false,
    usesCultivationType: false,
    allowProductImageOnCreate: true,
    allowProductImageOnEdit: false,
    stockUnit: "units",
    stockDisplaySuffix: "units",
    stockQuantityType: "integer"
  },
  Concentrates: {
    usesStrainType: false,
    usesCultivationType: false,
    allowProductImageOnCreate: true,
    allowProductImageOnEdit: false,
    stockUnit: "units",
    stockDisplaySuffix: "units",
    stockQuantityType: "integer"
  },
  Beverages: {
    usesStrainType: false,
    usesCultivationType: false,
    allowProductImageOnCreate: true,
    allowProductImageOnEdit: false,
    stockUnit: "units",
    stockDisplaySuffix: "units",
    stockQuantityType: "integer"
  },
  Accessories: {
    usesStrainType: false,
    usesCultivationType: false,
    allowProductImageOnCreate: true,
    allowProductImageOnEdit: false,
    stockUnit: "units",
    stockDisplaySuffix: "units",
    stockQuantityType: "integer"
  }
} as const satisfies Record<ProductCategory, ProductCategoryParameters>;

export function categorySlug(category: string) {
  return category.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function categoryButtonOrder(category: string) {
  const normalized = categorySlug(category);
  const index = PRODUCT_CATEGORY_BUTTON_ORDER.findIndex((item) => categorySlug(item) === normalized);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

export function categoryIdFor(category: string) {
  const ids: Record<ProductCategory, string> = {
    Flower: "20000000-0000-4000-8000-000000000101",
    "Vape Cartridges": "20000000-0000-4000-8000-000000000102",
    Edibles: "20000000-0000-4000-8000-000000000103",
    Concentrates: "20000000-0000-4000-8000-000000000104",
    "Pre-Rolls": "20000000-0000-4000-8000-000000000105",
    Beverages: "20000000-0000-4000-8000-000000000106",
    Accessories: "20000000-0000-4000-8000-000000000107",
    "Disposable Vapes": "20000000-0000-4000-8000-000000000108"
  };
  return isProductCategory(category) ? ids[category] : ids.Flower;
}

export function isProductCategory(value: unknown): value is ProductCategory {
  return typeof value === "string" && PRODUCT_CATEGORIES.includes(value as ProductCategory);
}

export function isValidSubcategory(category: ProductCategory, subcategory: string) {
  return PRODUCT_SUBCATEGORIES[category].includes(subcategory as never);
}

export function isCultivationType(value: unknown): value is CultivationType {
  return typeof value === "string" && CULTIVATION_TYPES.includes(value as CultivationType);
}

export function productCategoryParameters(category: unknown): ProductCategoryParameters {
  return isProductCategory(category) ? PRODUCT_CATEGORY_PARAMETERS[category] : {
    usesStrainType: false,
    usesCultivationType: false,
    allowProductImageOnCreate: false,
    allowProductImageOnEdit: false,
    stockUnit: "units",
    stockDisplaySuffix: "units",
    stockQuantityType: "integer"
  };
}

export function categoryUsesStrainType(category: unknown) {
  return productCategoryParameters(category).usesStrainType;
}

export function categoryAllowsCultivationType(category: unknown) {
  return productCategoryParameters(category).usesCultivationType;
}

export function categoryAllowsProductImageOnCreate(category: unknown) {
  return productCategoryParameters(category).allowProductImageOnCreate;
}

export function categoryAllowsProductImageOnEdit(category: unknown) {
  return productCategoryParameters(category).allowProductImageOnEdit;
}

export function stockUnitForCategory(category: unknown) {
  return productCategoryParameters(category).stockUnit;
}

export function stockDisplaySuffixForCategory(category: unknown) {
  return productCategoryParameters(category).stockDisplaySuffix;
}

export function stockQuantityTypeForCategory(category: unknown) {
  return productCategoryParameters(category).stockQuantityType;
}
