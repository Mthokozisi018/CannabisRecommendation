import type { ProductDTO, ProductFilters, ProductMatchDTO } from "@/lib/types";

type ScoreInput = {
  selectedEffectSlug: string;
  filters?: ProductFilters;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function includes(value: string | undefined, query: string) {
  return value?.toLowerCase().includes(query.toLowerCase()) ?? false;
}

function numericRangeScore(value: number | undefined, min?: number, max?: number) {
  if (value === undefined) return min === undefined && max === undefined ? 100 : 40;
  if (min !== undefined && value < min) return clamp(100 - (min - value) * 8);
  if (max !== undefined && value > max) return clamp(100 - (value - max) * 8);
  return 100;
}

export function productMatchesFilters(product: ProductDTO, filters: ProductFilters = {}) {
  if (filters.category && product.categorySlug !== filters.category) return false;
  if (filters.subcategory && product.subcategorySlug !== filters.subcategory) return false;
  if (filters.strainType && product.strainType !== filters.strainType) return false;
  if (filters.growType && product.growType !== filters.growType) return false;
  if (filters.brand && product.brand !== filters.brand) return false;
  if (filters.inStockOnly && product.stockStatus === "out_of_stock") return false;
  if (filters.thcMin !== undefined && (product.thcValue ?? 0) < filters.thcMin) return false;
  if (filters.thcMax !== undefined && (product.thcValue ?? 0) > filters.thcMax) return false;
  if (filters.cbdMin !== undefined && (product.cbdValue ?? 0) < filters.cbdMin) return false;
  if (filters.cbdMax !== undefined && (product.cbdValue ?? 0) > filters.cbdMax) return false;
  if (filters.priceMin !== undefined && product.priceCents < filters.priceMin * 100) return false;
  if (filters.priceMax !== undefined && product.priceCents > filters.priceMax * 100) return false;
  if (filters.dietary && product.facetValues.dietary !== filters.dietary) return false;
  if (filters.ratioTag && product.facetValues.ratioTag !== filters.ratioTag) return false;
  if (filters.hardwareFacet && product.facetValues.hardwareFacet !== filters.hardwareFacet) return false;
  if (filters.concentrateSubtype && product.facetValues.concentrateSubtype !== filters.concentrateSubtype) return false;

  if (filters.query) {
    const q = filters.query;
    const flavorHit = product.flavors.some((flavor) => includes(flavor.name, q));
    if (![product.name, product.brand, product.strainType, product.description].some((value) => includes(value, q)) && !flavorHit) {
      return false;
    }
  }

  return true;
}

export function scoreProduct(product: ProductDTO, input: ScoreInput): ProductMatchDTO {
  const selected = product.effects.find((item) => item.slug === input.selectedEffectSlug)?.scorePct ?? 0;
  const terpene = clamp((product.terpeneTotalPct ?? 0) * 14);
  const range = Math.round((numericRangeScore(product.thcValue, input.filters?.thcMin, input.filters?.thcMax) + numericRangeScore(product.cbdValue, input.filters?.cbdMin, input.filters?.cbdMax)) / 2);
  const rating = clamp(((product.ratingAvg ?? 0) / 5) * 100 + Math.min(product.ratingCount ?? 0, 200) / 10);
  const stockFreshness = clamp((product.stockStatus === "in_stock" ? 70 : product.stockStatus === "low_stock" ? 45 : 0) + (product.isNew ? 15 : 0) + (product.isOnSpecial ? 10 : 0));

  const matchPct = Math.round(selected * 0.55 + terpene * 0.15 + range * 0.1 + rating * 0.1 + stockFreshness * 0.1);

  return {
    ...product,
    matchPct,
    scoreBreakdown: {
      effect: Math.round(selected),
      terpene: Math.round(terpene),
      range,
      rating: Math.round(rating),
      stockFreshness: Math.round(stockFreshness)
    }
  };
}

export function rankProducts(products: ProductDTO[], input: ScoreInput) {
  return products
    .filter((product) => productMatchesFilters(product, input.filters))
    .map((product) => scoreProduct(product, input))
    .sort((a, b) => b.matchPct - a.matchPct || (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0));
}

export function categoryCounts(products: ProductDTO[], selectedEffectSlug: string, filters: ProductFilters = {}) {
  const counts = new Map<string, number>();
  rankProducts(products, { selectedEffectSlug, filters: { ...filters, category: undefined } }).forEach((product) => {
    counts.set(product.categorySlug, (counts.get(product.categorySlug) ?? 0) + 1);
  });
  return counts;
}
