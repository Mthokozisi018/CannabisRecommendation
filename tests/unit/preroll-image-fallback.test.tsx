// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ProductCard } from "@/components/receptionist/pos/ProductCard";
import { ProductDescriptionModal } from "@/components/receptionist/pos/ProductDescriptionModal";
import type { ReceptionistProduct } from "@/lib/receptionist/products";

vi.mock("@/app/actions", () => ({ logoutGreenChoiceStaffAction: vi.fn() }));
afterEach(cleanup);

const product: ReceptionistProduct = {
  id: "pre-roll", name: "Pre-Roll", categoryName: "Pre-Rolls", categorySlug: "pre-rolls", subcategory: "Hybrid", cultivationType: "Indoor", description: "",
  imageUrl: "https://example.invalid/missing.webp", imagePath: null, sizeLabel: "1 unit", strainType: "Hybrid", sellingPrice: 40,
  productStatus: "active", isVisibleOnPos: true, isActive: true, isNew: false, quantityAvailable: 3, lowStockThreshold: 1
};

it("replaces a broken POS card image with the Pre-Rolls default", () => {
  render(<ProductCard product={product} onAddToCart={() => undefined} onOpenDescription={() => undefined} />);
  const image = screen.getByAltText("Pre-Roll product image") as HTMLImageElement;
  fireEvent.error(image);
  expect(image.getAttribute("src")).toBe("/images/product-placeholders/pre-rolls/preroll-indoor.png");
});

it("replaces a broken Pre-Rolls modal image with cultivation artwork", () => {
  render(<ProductDescriptionModal product={product} onClose={() => undefined} />);
  fireEvent.error(screen.getByAltText("Pre-Roll product image"));
  expect((screen.getByAltText("Pre-Roll product image") as HTMLImageElement).getAttribute("src")).toBe("/products/prerolls/modulars/preroll-indoor-modular.png");
});
