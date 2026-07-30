import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { ProductCard } from "@/components/receptionist/pos/ProductCard";

vi.mock("@/app/actions", () => ({ logoutGreenChoiceStaffAction: vi.fn() }));

type CardProduct = ComponentProps<typeof ProductCard>["product"];

const baseProduct: CardProduct = {
  id: "pre-roll-1",
  name: "Test Pre-Roll",
  categoryName: "Pre-Rolls",
  categorySlug: "pre-rolls",
  subcategory: "Hybrid",
  cultivationType: "Indoor",
  description: "",
  imageUrl: "/old-pre-roll-image.png",
  imagePath: null,
  sizeLabel: "1 unit",
  strainType: "Hybrid",
  sellingPrice: 50,
  productStatus: "active",
  isActive: true,
  isNew: false,
  quantityAvailable: 10,
  lowStockThreshold: 2
};

function renderCard(product: CardProduct) {
  return renderToStaticMarkup(<ProductCard product={product} onAddToCart={() => undefined} onOpenDescription={() => undefined} />);
}

describe("Pre-Rolls product card artwork", () => {
  it.each([
    ["Indoor", "preroll-indoor.png"],
    ["Greenhouse", "preroll-greenhouse.png"],
    ["Outdoor", "preroll-outdoor.png"]
  ])("uses the official %s artwork", (cultivationType, expectedFile) => {
    const markup = renderCard({ ...baseProduct, cultivationType });

    expect(markup).toContain(`/images/product-placeholders/pre-rolls/${expectedFile}`);
    expect(markup).not.toContain("/old-pre-roll-image.png");
    expect(markup).toContain("object-contain");
  });

  it("preserves the current fallback for an unexpected cultivation type", () => {
    const markup = renderCard({ ...baseProduct, cultivationType: "Hydro" });

    expect(markup).toContain("/old-pre-roll-image.png");
    expect(markup).toContain("object-contain p-2");
  });

  it("leaves Flower and every other product category on the existing image path", () => {
    for (const categoryName of ["Flower", "Vape Cartridges", "Edibles", "Concentrates", "Accessories"]) {
      const markup = renderCard({
        ...baseProduct,
        categoryName,
        categorySlug: categoryName.toLowerCase().replaceAll(" ", "-"),
        imageUrl: `/existing-${categoryName.toLowerCase().replaceAll(" ", "-")}.png`
      });

      expect(markup).toContain(`/existing-${categoryName.toLowerCase().replaceAll(" ", "-")}.png`);
      expect(markup).not.toContain("/images/product-placeholders/pre-rolls/preroll-");
      expect(markup).toContain("object-contain p-2");
    }
  });

  it("shows the grams price unit only on Flower receptionist cards", () => {
    const flowerMarkup = renderCard({
      ...baseProduct,
      categoryName: "Flower",
      categorySlug: "flower",
      sizeLabel: null
    });
    const preRollMarkup = renderCard(baseProduct);

    expect(flowerMarkup).toContain("/grams");
    expect(preRollMarkup).not.toContain("/grams");
    expect(preRollMarkup).toContain("/ 1 unit");
  });
});
