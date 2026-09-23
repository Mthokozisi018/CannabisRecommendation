"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { CustomerProductGrid } from "@/components/customer/CustomerProductGrid";
import { FilterPanel } from "@/components/receptionist/pos/FilterPanel";
import {
  allowedCategorySlugs,
  categoryUsesSecondaryFilter,
  cultivationKey,
  displaySubcategory,
  getCultivationOptions,
  normalize,
  preferredSubcategoryOrder,
  resolveProductSelection,
  subcategoryKey,
} from "@/components/receptionist/pos/pos-helpers";
import type { SubcategoryOption } from "@/components/receptionist/pos/pos-types";
import { isProductCategory, PRODUCT_SUBCATEGORIES } from "@/lib/manager/options";
import type { ReceptionistCategory, ReceptionistProduct } from "@/lib/receptionist/products";

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/14 bg-white/[0.04] p-8 text-center">
      <p className="text-2xl font-extrabold">{title}</p>
      <p className="mt-2 text-white/62">{body}</p>
    </div>
  );
}

function getSubcategoryOptions(products: ReceptionistProduct[], selectedCategory: ReceptionistCategory | null): SubcategoryOption[] {
  if (!selectedCategory) return [];

  const optionMap = new Map<string, SubcategoryOption>();
  products.forEach((product) => {
    const matchesSelectedCategory =
      product.categorySlug === selectedCategory.slug || normalize(product.categoryName) === normalize(selectedCategory.name);

    if (!matchesSelectedCategory || !product.subcategory) return;

    const key = subcategoryKey(product.subcategory);
    const existing = optionMap.get(key);
    if (existing) {
      existing.count += 1;
      return;
    }

    optionMap.set(key, {
      label: displaySubcategory(product.subcategory),
      value: product.subcategory,
      count: 1
    });
  });

  const allowedSubcategories = isProductCategory(selectedCategory.name) ? PRODUCT_SUBCATEGORIES[selectedCategory.name] : null;
  const preferredOrder = allowedSubcategories ? [...allowedSubcategories] : preferredSubcategoryOrder[selectedCategory.slug] ?? [];
  const options = Array.from(optionMap.values()).filter((item) => !allowedSubcategories || allowedSubcategories.includes(item.value as never));

  return options.sort((a, b) => {
    const aIndex = preferredOrder.findIndex((item) => subcategoryKey(item) === subcategoryKey(a.value));
    const bIndex = preferredOrder.findIndex((item) => subcategoryKey(item) === subcategoryKey(b.value));
    if (aIndex !== -1 || bIndex !== -1) return (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex);
    return a.label.localeCompare(b.label);
  });
}

function getFilteredProducts({
  products,
  selectedCategory,
  subcategory,
  showCultivationFilter,
  cultivationType
}: {
  products: ReceptionistProduct[];
  selectedCategory: ReceptionistCategory | null;
  subcategory: string;
  showCultivationFilter: boolean;
  cultivationType: string;
}) {
  if (!selectedCategory || !subcategory || (showCultivationFilter && !cultivationType)) return [];

  const selectedSubcategory = subcategoryKey(subcategory);
  return products.filter((product) => {
    const matchesCategory = product.categorySlug === selectedCategory.slug || normalize(product.categoryName) === normalize(selectedCategory.name);
    const matchesCultivation = !showCultivationFilter || cultivationKey(product.cultivationType) === cultivationKey(cultivationType);
    const matchesSubcategory = subcategoryKey(product.subcategory) === selectedSubcategory;
    return matchesCategory && matchesCultivation && matchesSubcategory;
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export function CustomerStoreCatalog({ products, categories, initialCategory, storeId }: { products: ReceptionistProduct[]; categories: ReceptionistCategory[]; initialCategory?: string; storeId: string }) {
  const [category, setCategory] = useState(initialCategory ?? "");
  const [cultivationType, setCultivationType] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const strainPanelRef = useRef<HTMLDivElement>(null);

  const visibleCategories = useMemo(() => categories.filter((item) => allowedCategorySlugs.has(item.slug)), [categories]);
  const resolvedSelection = useMemo(() => resolveProductSelection({
    products,
    categories: visibleCategories,
    current: { category, subcategory, cultivationType }
  }), [category, cultivationType, products, subcategory, visibleCategories]);
  const effectiveCategory = resolvedSelection?.category ?? category;
  const effectiveSubcategory = resolvedSelection?.subcategory ?? subcategory;
  const effectiveCultivationType = resolvedSelection?.cultivationType ?? cultivationType;

  const selectedCategory = useMemo(() => {
    if (!effectiveCategory) return null;
    return visibleCategories.find((item) => item.slug === effectiveCategory || normalize(item.name) === normalize(effectiveCategory)) ?? null;
  }, [effectiveCategory, visibleCategories]);
  const showCultivationFilter = categoryUsesSecondaryFilter(selectedCategory);
  const hasRequiredFilters = Boolean(selectedCategory && effectiveSubcategory && (!showCultivationFilter || effectiveCultivationType));

  const subcategoryOptions = useMemo(() => getSubcategoryOptions(products, selectedCategory), [products, selectedCategory]);
  const cultivationOptions = useMemo(() => getCultivationOptions(products, selectedCategory, effectiveSubcategory), [effectiveSubcategory, products, selectedCategory]);
  const filteredProducts = useMemo(() => getFilteredProducts({ products, selectedCategory, subcategory: effectiveSubcategory, showCultivationFilter, cultivationType: effectiveCultivationType }), [effectiveCultivationType, effectiveSubcategory, products, selectedCategory, showCultivationFilter]);

  const selectCategory = useCallback((nextCategory: string) => {
    setCategory(nextCategory);
    setSubcategory("");
    setCultivationType("");
    if (!nextCategory) return;

    const nextCategoryRecord = visibleCategories.find((item) => item.slug === nextCategory || normalize(item.name) === normalize(nextCategory));
    if (!nextCategoryRecord || !categoryUsesSecondaryFilter(nextCategoryRecord)) {
      setCultivationType("");
    }
  }, [visibleCategories]);

  const selectSubcategory = useCallback((nextSubcategory: string) => {
    setCategory(effectiveCategory);
    setSubcategory(nextSubcategory);
    setCultivationType("");
  }, [effectiveCategory]);

  const selectCultivationType = useCallback((nextCultivationType: string) => {
    setCategory(effectiveCategory);
    setSubcategory(effectiveSubcategory);
    setCultivationType(nextCultivationType);
  }, [effectiveCategory, effectiveSubcategory]);

  return (
    <>
      <FilterPanel
        message={null}
        visibleCategories={visibleCategories}
        category={effectiveCategory}
        showCultivationFilter={showCultivationFilter}
        cultivationType={effectiveCultivationType}
        subcategory={effectiveSubcategory}
        subcategoryOptions={selectedCategory ? subcategoryOptions : []}
        cultivationOptions={cultivationOptions}
        strainPanelRef={strainPanelRef}
        visualStyle="receptionist"
        onSelectCategory={selectCategory}
        onSelectCultivationType={selectCultivationType}
        onSelectSubcategory={selectSubcategory}
      />

      <div>
        {products.length === 0 ? (
          <EmptyState title="No products available yet." body="Products added by the store will appear here." />
        ) : !hasRequiredFilters ? (
          <EmptyState title="Select a category and filters to view products." body="Choose a category, then select the required filter buttons." />
        ) : filteredProducts.length === 0 ? (
          <EmptyState title="No matching products found." body="Try a different category or filter combination." />
        ) : (
          <CustomerProductGrid products={filteredProducts} storeId={storeId} />
        )}
      </div>
    </>
  );
}
