import { describe, expect, it } from "vitest";
import { PRODUCTS } from "@/lib/data";
import { parseFilters } from "@/lib/schemas/filters";
import { rankProducts } from "@/lib/services/recommendation";

describe("recommendation scoring", () => {
  it("ranks Gelato #33 highly for relaxed", () => {
    const results = rankProducts(PRODUCTS, { selectedEffectSlug: "relaxed" });
    expect(results[0].matchPct).toBeGreaterThan(70);
    expect(results.slice(0, 5).some((product) => product.slug === "gelato-33")).toBe(true);
  });

  it("applies category filters", () => {
    const results = rankProducts(PRODUCTS, { selectedEffectSlug: "focused", filters: { category: "vapes", hardwareFacet: "510 thread" } });
    expect(results.every((product) => product.categorySlug === "vapes")).toBe(true);
    expect(results.every((product) => product.facetValues.hardwareFacet === "510 thread")).toBe(true);
  });
});

describe("filter parsing", () => {
  it("normalizes numbers and booleans", () => {
    const filters = parseFilters({ thcMin: "10", priceMax: "300", inStockOnly: "true" });
    expect(filters.thcMin).toBe(10);
    expect(filters.priceMax).toBe(300);
    expect(filters.inStockOnly).toBe(true);
  });
});
