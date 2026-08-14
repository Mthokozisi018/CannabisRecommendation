import "server-only";
import { CATEGORIES, EFFECTS, PRODUCTS } from "@/lib/data";
import type { CategoryWithCountDTO, EffectDTO, ProductDTO, ProductFilters, ProductMatchDTO } from "@/lib/types";
import { categoryCounts, rankProducts } from "@/lib/services/recommendation";
import { categoryButtonOrder } from "@/lib/manager/options";
import { requireStaff } from "./auth";

export async function listEffects(): Promise<EffectDTO[]> {
  await requireStaff();
  return [...EFFECTS].sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function listCategories(selectedEffectSlug = "relaxed", filters: ProductFilters = {}): Promise<CategoryWithCountDTO[]> {
  await requireStaff();
  const counts = categoryCounts(PRODUCTS, selectedEffectSlug, filters);
  return CATEGORIES.map((category) => ({ ...category, count: counts.get(category.slug) ?? 0 }))
    .sort((a, b) => categoryButtonOrder(a.name) - categoryButtonOrder(b.name) || a.sortOrder - b.sortOrder);
}

export async function listRecommendedProducts(selectedEffectSlug: string, filters: ProductFilters = {}): Promise<ProductMatchDTO[]> {
  const staff = await requireStaff();
  return rankProducts(PRODUCTS.filter((product) => product.storeId === staff.storeId), { selectedEffectSlug, filters });
}

export async function getProductBySlug(slug: string, selectedEffectSlug = "relaxed"): Promise<ProductMatchDTO | null> {
  const staff = await requireStaff();
  const product = PRODUCTS.find((item) => item.slug === slug && item.storeId === staff.storeId);
  if (!product) return null;
  return rankProducts([product], { selectedEffectSlug })[0] ?? null;
}

export async function getProductById(id: string): Promise<ProductDTO | null> {
  const staff = await requireStaff();
  return PRODUCTS.find((item) => item.id === id && item.storeId === staff.storeId) ?? null;
}

export async function getFilterOptions(category?: string): Promise<{
  brands: string[];
  strainTypes: string[];
  growTypes: string[];
  subcategories: string[];
  dietary: string[];
  ratioTags: string[];
  hardwareFacets: string[];
  concentrateSubtypes: string[];
}> {
  await requireStaff();
  const scoped = category ? PRODUCTS.filter((product) => product.categorySlug === category) : PRODUCTS;
  const uniq = (items: (string | undefined)[]) => [...new Set(items.filter(Boolean) as string[])].sort();
  return {
    brands: uniq(scoped.map((product) => product.brand)),
    strainTypes: uniq(scoped.map((product) => product.strainType)),
    growTypes: uniq(scoped.map((product) => product.growType)),
    subcategories: uniq(scoped.map((product) => product.subcategorySlug)),
    dietary: uniq(scoped.map((product) => product.facetValues.dietary as string | undefined)),
    ratioTags: uniq(scoped.map((product) => product.facetValues.ratioTag as string | undefined)),
    hardwareFacets: uniq(scoped.map((product) => product.facetValues.hardwareFacet as string | undefined)),
    concentrateSubtypes: uniq(scoped.map((product) => product.facetValues.concentrateSubtype as string | undefined))
  };
}
