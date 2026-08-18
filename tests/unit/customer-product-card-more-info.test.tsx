import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProductCard } from "@/components/ProductCard";
import type { ProductMatchDTO } from "@/lib/types";

vi.mock("@/app/actions", () => ({ addToCartAction: vi.fn() }));

const product: ProductMatchDTO = {
  id: "product-1",
  storeId: "store-1",
  categorySlug: "flower",
  categoryName: "Flower",
  subcategorySlug: "indoor",
  slug: "gelato-33",
  name: "Gelato #33",
  brand: "Emerald Room",
  strainType: "Hybrid",
  growType: "Indoor",
  geneticsSummary: "Sunset Sherbet x Thin Mint GSC",
  bestTimeOfUse: "Late afternoon",
  description: "Dense indoor flower with dessert aromatics.",
  priceCents: 18500,
  sizeLabel: "3.5 g",
  ratingAvg: 4.8,
  ratingCount: 214,
  thcValue: 24.2,
  thcUnit: "%",
  cbdValue: 0.6,
  cbdUnit: "%",
  terpeneTotalPct: 2.4,
  isLabTested: true,
  isOnSpecial: false,
  isNew: true,
  stockStatus: "in_stock",
  stockOnHand: 28,
  facetValues: {},
  images: [],
  effects: [],
  terpenes: [],
  flavors: [],
  lineage: [],
  matchPct: 92,
  scoreBreakdown: {
    effect: 92,
    terpene: 80,
    range: 75,
    rating: 90,
    stockFreshness: 88
  }
};

describe("customer ProductCard More Info affordance", () => {
  it("keeps one GreenChoice star control that opens product information", () => {
    const markup = renderToStaticMarkup(<ProductCard product={product} effect="relaxed" />);

    expect(markup.match(/More Info/g)).toHaveLength(1);
    expect(markup).toContain("gc-pos-product-info-button");
    expect(markup).toContain('aria-label="View Gelato #33 information"');
    expect(markup).toContain('href="/products/gelato-33?effect=relaxed"');
  });
});
