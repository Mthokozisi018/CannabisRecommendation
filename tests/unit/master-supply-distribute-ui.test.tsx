// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { masterSupplyAction } from "@/app/dashboard/franchise/supply/actions";
import { SupplyDistribute } from "@/components/master-supply/SupplyDistribute";
import { createSupplyDemoSnapshot } from "@/lib/master-supply/demo-data";
import type { SupplyStore } from "@/lib/master-supply/data";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/dashboard/franchise/supply/actions", () => ({ masterSupplyAction: vi.fn() }));
afterEach(() => { cleanup(); vi.mocked(masterSupplyAction).mockReset(); });

const store: SupplyStore = { id: "store", name: "Centurion Branch", city: "Centurion", province: "Gauteng", store_image_url: null, is_active: true, store_access_status: "active" };

function inventory() {
  const snapshot = createSupplyDemoSnapshot("franchise", "actor", [], new Date("2026-10-20T10:00:00Z"));
  snapshot.stores = [store];
  const flower = snapshot.products[0];
  snapshot.products.push({ ...flower, id: "outdoor", sku: "GC-OUT", name: "Outdoor Flower", subcategory: "Indica", strain_type: "Indica", cultivation_type: "Outdoor" });
  snapshot.products.push({ ...flower, id: "preroll", sku: "GC-PR", name: "Indoor Pre-Roll", category: "Pre-Rolls", subcategory: "Indica", strain_type: null });
  snapshot.products.push({ ...flower, id: "disposable", sku: "GC-DIS", name: "Disposable Vape", category: "Disposable Vapes", subcategory: "Indica", strain_type: "Indica", cultivation_type: null });
  return snapshot;
}

const category = () => screen.getByRole("combobox", { name: "Category" }) as HTMLSelectElement;
const options = (name: string) => within(screen.getByRole("combobox", { name })).getAllByRole("option").map(item => item.textContent);

it("uses the receptionist product images and category-dependent filters", () => {
  render(<SupplyDistribute snapshot={inventory()} />);
  expect(category().value).toBe("Flower");
  expect(options("Category")).toEqual(["Flower", "Pre-Rolls", "Edibles", "Accessories", "Concentrates", "Vape Cartridges / Disposables"]);
  expect(screen.getByRole("img", { name: "GreenChoice Sunrise Flower product image" }).getAttribute("src")).toBe("/images/flower-placeholders/indoor.png");
  expect(screen.getByRole("img", { name: "GreenChoice Coastal Flower product image" }).getAttribute("src")).toBe("/images/flower-placeholders/greenhouse.png");
  expect(screen.getByRole("img", { name: "Outdoor Flower product image" }).getAttribute("src")).toBe("/images/flower-placeholders/outdoor.png");
  expect(options("Subcategory")).toEqual(["All Subcategories", "Sativa", "Indica", "Hybrid"]);
  fireEvent.change(screen.getByRole("combobox", { name: "Strain type" }), { target: { value: "Indica" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Cultivation" }), { target: { value: "Outdoor" } });
  expect(within(screen.getByRole("table")).getByText("Outdoor Flower")).toBeTruthy();
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);

  const categories = [
    ["Pre-Rolls", "Indoor Pre-Roll", "/images/product-placeholders/pre-rolls/preroll-indoor.png", true],
    ["Edibles", "GreenChoice Citrus Gummies", "/placeholder-images/gummies.png", false],
    ["Accessories", "GreenChoice Storage Jar", "/placeholder-images/Storage Tin.png", false],
    ["Concentrates", "GreenChoice Balance Concentrate", "/placeholder-images/Dap.png", false],
    ["Vape Cartridges", "GreenChoice Botanical Vape", "/placeholder-images/Vape Cartige .png", false],
  ] as const;
  for (const [value, name, image, hasStrain] of categories) {
    fireEvent.change(category(), { target: { value } });
    expect(screen.getByRole("img", { name: `${name} product image` }).getAttribute("src")).toBe(image);
    expect(Boolean(screen.queryByRole("combobox", { name: "Strain type" }))).toBe(hasStrain);
    expect(screen.queryByRole("combobox", { name: "Cultivation" })).toBeNull();
  }
  expect(screen.getByRole("img", { name: "Disposable Vape product image" }).getAttribute("src")).toBe("/images/placeholders/vape-cartridges.png");
  expect(options("Subcategory")).toEqual(["All Subcategories", "Vape Cartridge", "Indica"]);
  fireEvent.change(screen.getByRole("textbox", { name: "Search products" }), { target: { value: "Disposable" } });
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Clear Filters" }));
  expect(category().value).toBe("Flower");
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(4);
});

it("summarizes selected quantities, blocks excess stock, and confirms the existing distribution action", async () => {
  vi.mocked(masterSupplyAction).mockResolvedValue({ ok: true, id: "distribution" });
  const snapshot = inventory();
  render(<SupplyDistribute snapshot={snapshot} />);
  const continueButton = screen.getByRole("button", { name: /Continue to Review/ });
  expect(continueButton.hasAttribute("disabled")).toBe(true);
  fireEvent.change(screen.getByRole("combobox", { name: "Destination store" }), { target: { value: store.id } });
  fireEvent.click(screen.getByRole("checkbox", { name: `Select ${snapshot.products[0].name}` }));
  fireEvent.change(screen.getByRole("spinbutton", { name: `Quantity for ${snapshot.products[0].name}` }), { target: { value: "3" } });
  expect(screen.getByText("Selected Products (1)")).toBeTruthy();
  expect(screen.getByText("3 units")).toBeTruthy();
  expect(screen.getByText("Total Units").parentElement?.textContent).toContain("3");
  expect(continueButton.hasAttribute("disabled")).toBe(false);
  fireEvent.click(screen.getByRole("checkbox", { name: `Select ${snapshot.products[1].name}` }));
  fireEvent.change(screen.getByRole("spinbutton", { name: `Quantity for ${snapshot.products[1].name}` }), { target: { value: "2" } });
  expect(screen.getByText("Selected Products (2)")).toBeTruthy();
  expect(screen.getByText("Total Units").parentElement?.textContent).toContain("5");
  fireEvent.click(screen.getByRole("button", { name: `Remove ${snapshot.products[1].name}` }));
  expect(screen.getByText("Total Units").parentElement?.textContent).toContain("3");
  fireEvent.change(screen.getByRole("spinbutton", { name: `Quantity for ${snapshot.products[0].name}` }), { target: { value: "999" } });
  expect(continueButton.hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("alert").textContent).toContain("exceed available");
  fireEvent.change(screen.getByRole("spinbutton", { name: `Quantity for ${snapshot.products[0].name}` }), { target: { value: "3" } });
  fireEvent.click(screen.getByRole("button", { name: "Direct Collection" }));
  fireEvent.click(continueButton);
  expect(screen.getByRole("heading", { name: "Review Distribution" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirm Distribution" }));
  await waitFor(() => expect(masterSupplyAction).toHaveBeenCalledWith("distribute", expect.objectContaining({
    storeId: store.id, requestId: null, deliveryMethod: "collection", items: [{ productId: snapshot.products[0].id, quantity: 3 }],
  })));
  expect(await screen.findByText("Distribution created")).toBeTruthy();
});

it("keeps request conversion quantities within approval and central availability", () => {
  const snapshot = inventory();
  const product = snapshot.products[0];
  snapshot.requests.push({ id: "request", franchise_id: snapshot.franchiseId, store_id: store.id, requested_by: "manager", status: "approved", notes: "", created_at: "2026-10-20T10:00:00Z", reviewed_at: "2026-10-20T10:00:00Z", master_supply_request_items: [{ product_id: product.id, requested_quantity: 4, approved_quantity: 2 }] });
  render(<SupplyDistribute snapshot={snapshot} requestId="request" />);
  expect((screen.getByRole("combobox", { name: "Destination store" }) as HTMLSelectElement).disabled).toBe(true);
  expect((screen.getByRole("spinbutton", { name: `Quantity for ${product.name}` }) as HTMLInputElement).value).toBe("2");
  fireEvent.change(screen.getByRole("spinbutton", { name: `Quantity for ${product.name}` }), { target: { value: "3" } });
  expect(screen.getByRole("button", { name: /Continue to Review/ }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: `Remove ${product.name}` }));
  expect(screen.getByText("No products selected")).toBeTruthy();
});

it("shows five actual products per page and keeps selection across pages", () => {
  const snapshot = inventory();
  for (let index = 0; index < 3; index++) snapshot.products.push({ ...snapshot.products[0], id: `extra-${index}`, sku: `GC-EX-${index}`, name: `Extra Flower ${index}` });
  render(<SupplyDistribute snapshot={snapshot} />);
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(6);
  fireEvent.click(screen.getByRole("checkbox", { name: `Select ${snapshot.products[0].name}` }));
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);
  expect(screen.getByText("Selected Products (1)")).toBeTruthy();
  fireEvent.change(screen.getByRole("combobox", { name: "Products per page" }), { target: { value: "10" } });
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(7);
});
