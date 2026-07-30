import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { ProductCard } from "@/components/receptionist/pos/ProductCard";

vi.mock("@/app/actions", () => ({ logoutGreenChoiceStaffAction: vi.fn() }));

type CardProduct = ComponentProps<typeof ProductCard>["product"];

const baseProduct: CardProduct = {
  id: "edible-1",
  name: "Chocolate Cookie",
  categoryName: "Edibles",
  categorySlug: "edibles",
  subcategory: "Cookies",
  cultivationType: null,
  description: "",
  thcPerUnitMg: 10,
  thcPerPacketMg: 100,
  imageUrl: "/cookies.png",
  imagePath: null,
  sizeLabel: "10 cookies",
  strainType: null,
  sellingPrice: 120,
  productStatus: "active",
  isActive: true,
  isNew: false,
  quantityAvailable: 30,
  lowStockThreshold: 5
};

function renderCard(product: CardProduct) {
  return renderToStaticMarkup(<ProductCard product={product} onAddToCart={() => undefined} onOpenDescription={() => undefined} />);
}

describe("Edibles product card THC badges", () => {
  it("shows serving and packet THC badges for packet edibles", () => {
    const markup = renderCard(baseProduct);

    expect(markup).toContain("THC per serving");
    expect(markup).toContain("10 mg");
    expect(markup).toContain("THC per packet");
    expect(markup).toContain("100 mg");
  });

  it("does not show the numeric stock quantity on the product card", () => {
    const markup = renderCard(baseProduct);

    expect(markup).toContain("In Stock");
    expect(markup).not.toContain("30 units");
  });

  it("shows only the serving badge for a single edible item", () => {
    const markup = renderCard({ ...baseProduct, thcPerPacketMg: 10, sizeLabel: "1 cookie" });

    expect(markup).toContain("THC per serving");
    expect(markup).toContain("10 mg");
    expect(markup).not.toContain("THC per packet");
  });

  it("hides unavailable THC values without placeholder text", () => {
    const markup = renderCard({ ...baseProduct, thcPerUnitMg: null, thcPerPacketMg: null });

    expect(markup).not.toContain("THC per serving");
    expect(markup).not.toContain("THC per packet");
    expect(markup).not.toContain("undefined");
    expect(markup).not.toContain("NaN");
  });

  it("does not add THC badges to non-Edibles cards", () => {
    const markup = renderCard({ ...baseProduct, categoryName: "Accessories", categorySlug: "accessories", subcategory: "Lighters" });

    expect(markup).not.toContain("THC per serving");
    expect(markup).not.toContain("THC per packet");
  });
});
