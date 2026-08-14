export const PRODUCT_PLACEHOLDERS = {
  flower: "/images/placeholders/flower.png",
  preRolls: "/images/placeholders/pre-rolls.png",
  edibles: "/images/placeholders/edibles.png",
  accessories: "/images/placeholders/accessories.png",
  concentrates: "/images/placeholders/concentrates.png",
  vapeCartridges: "/images/placeholders/vape-cartridges.png"
} as const;

export const PRODUCT_SUBCATEGORY_PLACEHOLDERS = {
  flower: "/placeholder-images/Flower.png",
  "pre-rolls": "/placeholder-images/PreRolls.png",
  "vape-cartridges": "/placeholder-images/Vape Cartige .png",
  concentrates: "/placeholder-images/Dap.png",
  dab: "/placeholder-images/Dap.png",
  gummies: "/placeholder-images/gummies.png",
  chocolates: "/placeholder-images/chocolate.png",
  "baked-goods": "/placeholder-images/backed Goods.png",
  drinks: "/placeholder-images/beverage.png",
  beverage: "/placeholder-images/beverage.png",
  beverages: "/placeholder-images/beverage.png",
  lighters: "/placeholder-images/lighter.png",
  "grinders-crushers": "/placeholder-images/Grinder.png",
  grinders: "/placeholder-images/Grinder.png",
  crushers: "/placeholder-images/Grinder.png",
  "rolling-papers": "/placeholder-images/rolling paper.png",
  "storage-jars": "/placeholder-images/Storage Tin.png",
  "storage-tin": "/placeholder-images/Storage Tin.png",
  storage: "/placeholder-images/Storage Tin.png",
  jars: "/placeholder-images/Storage Tin.png",
  tray: "/placeholder-images/tray.png"
} as const;

export const DEFAULT_PRODUCT_PLACEHOLDER = PRODUCT_PLACEHOLDERS.accessories;

export const FLOWER_CULTIVATION_PLACEHOLDERS = {
  indoor: "/images/flower-placeholders/indoor.png",
  greenhouse: "/images/flower-placeholders/greenhouse.png",
  outdoor: "/images/flower-placeholders/outdoor.png"
} as const;

export const PREROLL_CULTIVATION_CARD_IMAGES = {
  indoor: "/images/product-placeholders/pre-rolls/preroll-indoor.png",
  greenhouse: "/images/product-placeholders/pre-rolls/preroll-greenhouse.png",
  outdoor: "/images/product-placeholders/pre-rolls/preroll-outdoor.png"
} as const;

export type ProductImageInput = {
  image_url?: string | null;
  imageUrl?: string | null;
  category?: string | null;
  categoryName?: string | null;
  categorySlug?: string | null;
  subcategory?: string | null;
  cultivation_type?: string | null;
  cultivationType?: string | null;
  growType?: string | null;
};

function normalizeCategory(category?: string | null) {
  return (category ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value?: string | null) {
  return normalizeCategory(value).replace(/\s+/g, "-");
}

function isFlowerCategory(category?: string | null) {
  return (category ?? "").trim().toLowerCase() === "flower";
}

export function isUsableProductImageUrl(value?: string | null) {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return trimmed.startsWith("/") || trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("blob:");
}

export function getFlowerCultivationPlaceholder(cultivationType?: string | null) {
  const normalized = cultivationType?.trim().toLowerCase();
  if (!normalized) return null;
  return FLOWER_CULTIVATION_PLACEHOLDERS[normalized as keyof typeof FLOWER_CULTIVATION_PLACEHOLDERS] ?? null;
}

export function getPreRollCultivationCardImage(product: ProductImageInput) {
  const category = product.category ?? product.categoryName ?? product.categorySlug;
  if (slugify(category) !== "pre-rolls") return null;

  const cultivationType = product.cultivation_type ?? product.cultivationType ?? product.growType;
  const normalized = cultivationType?.trim().toLowerCase();
  if (!normalized) return null;
  return PREROLL_CULTIVATION_CARD_IMAGES[normalized as keyof typeof PREROLL_CULTIVATION_CARD_IMAGES] ?? null;
}

export function getSubcategoryPlaceholder(category?: string | null, subcategory?: string | null) {
  const categoryKey = slugify(category);
  const subcategoryKey = slugify(subcategory);

  if (categoryKey === "edibles" && subcategoryKey in PRODUCT_SUBCATEGORY_PLACEHOLDERS) {
    return PRODUCT_SUBCATEGORY_PLACEHOLDERS[subcategoryKey as keyof typeof PRODUCT_SUBCATEGORY_PLACEHOLDERS];
  }

  if (categoryKey === "accessories" && subcategoryKey in PRODUCT_SUBCATEGORY_PLACEHOLDERS) {
    return PRODUCT_SUBCATEGORY_PLACEHOLDERS[subcategoryKey as keyof typeof PRODUCT_SUBCATEGORY_PLACEHOLDERS];
  }

  if (categoryKey === "concentrates" && subcategoryKey === "dab") return PRODUCT_SUBCATEGORY_PLACEHOLDERS.dab;
  if (categoryKey === "flower") return PRODUCT_SUBCATEGORY_PLACEHOLDERS.flower;
  if (categoryKey === "pre-rolls") return PRODUCT_SUBCATEGORY_PLACEHOLDERS["pre-rolls"];
  if (categoryKey === "vape-cartridges") return PRODUCT_SUBCATEGORY_PLACEHOLDERS["vape-cartridges"];

  return null;
}

export function getCategoryPlaceholder(category?: string | null) {
  const normalized = normalizeCategory(category);

  if (!normalized) return DEFAULT_PRODUCT_PLACEHOLDER;
  if (normalized.includes("flower")) return PRODUCT_PLACEHOLDERS.flower;
  if (normalized.includes("pre roll") || normalized.includes("preroll")) return PRODUCT_PLACEHOLDERS.preRolls;
  if (normalized.includes("edible") || normalized.includes("beverage") || normalized.includes("drink")) return PRODUCT_PLACEHOLDERS.edibles;
  if (normalized.includes("concentrate") || normalized === "dab" || normalized === "dap" || normalized.includes(" dab")) return PRODUCT_PLACEHOLDERS.concentrates;
  if (normalized.includes("vape") || normalized.includes("cartridge") || normalized.includes("disposable")) return PRODUCT_PLACEHOLDERS.vapeCartridges;
  if (normalized.includes("accessor") || normalized.includes("lighter") || normalized.includes("grinder") || normalized.includes("crusher") || normalized.includes("rolling paper")) {
    return PRODUCT_PLACEHOLDERS.accessories;
  }

  return DEFAULT_PRODUCT_PLACEHOLDER;
}

export function getProductImage(product: ProductImageInput) {
  const customImage = product.image_url ?? product.imageUrl;
  if (isUsableProductImageUrl(customImage)) return customImage!.trim();
  const category = product.category ?? product.categoryName ?? product.categorySlug;
  const cultivationType = product.cultivation_type ?? product.cultivationType ?? product.growType;
  const flowerPlaceholder = isFlowerCategory(category) ? getFlowerCultivationPlaceholder(cultivationType) : null;
  if (flowerPlaceholder) return flowerPlaceholder;
  return getSubcategoryPlaceholder(category, product.subcategory) ?? getCategoryPlaceholder(category);
}
