// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { SupplyInventory } from "@/components/master-supply/SupplyInventory";
import { ProductLabel } from "@/components/master-supply/shared";
import { createSupplyDemoSnapshot } from "@/lib/master-supply/demo-data";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/dashboard/franchise/supply/actions", () => ({ masterSupplyAction: vi.fn() }));
afterEach(cleanup);

it("shows uploaded product thumbnails and falls back through category and GreenChoice images", () => {
  const product = { ...inventory().products[0], image_url: "https://example.com/uploaded-flower.png" };
  const { container, rerender } = render(<ProductLabel product={product} />);
  const thumbnail = container.querySelector("img") as HTMLImageElement;
  expect(thumbnail.getAttribute("src")).toBe(product.image_url);
  expect(thumbnail.getAttribute("width")).toBe("44");
  expect(thumbnail.getAttribute("height")).toBe("44");
  expect(screen.getByText(product.name)).toBeTruthy();
  expect(screen.getByText(product.sku)).toBeTruthy();

  fireEvent.error(thumbnail);
  expect(thumbnail.getAttribute("src")).toBe("/images/placeholders/flower.png");
  fireEvent.error(thumbnail);
  expect(thumbnail.getAttribute("src")).toBe("/branding/greenchoice-logo.png");
  fireEvent.error(thumbnail);
  expect(container.querySelector("img")).toBeNull();

  rerender(<ProductLabel product={{ ...product, image_url: null, category: "Edibles" }} />);
  expect(container.querySelector("img")?.getAttribute("src")).toMatch(/\/images\/placeholders\/edibles\.png$/);
  rerender(<ProductLabel product={{ ...product, image_url: null, category: "Uncategorized" }} />);
  expect(container.querySelector("img")?.getAttribute("src")).toMatch(/\/branding\/greenchoice-logo\.png$/);
});

it("keeps inventory columns and View and Add Stock actions usable with thumbnails", () => {
  render(<SupplyInventory snapshot={inventory()} />);
  const table = screen.getByRole("table");
  expect(within(table).getAllByRole("columnheader").map(header => header.textContent)).toEqual([
    "Product", "Category", "Subcategory", "Strain Type", "Cultivation", "Current Stock", "Last Added", "Actions"
  ]);
  expect(table.querySelectorAll("tbody img").length).toBe(table.querySelectorAll("tbody tr").length);

  fireEvent.click(within(table).getAllByRole("button", { name: "View" })[0]);
  expect(screen.getByRole("dialog", { name: "Product details" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  fireEvent.click(within(table).getAllByRole("button", { name: "Add Stock" })[0]);
  expect(screen.getByRole("dialog", { name: "Add stock" })).toBeTruthy();
});

function inventory() {
  const snapshot = createSupplyDemoSnapshot("franchise", "actor", [], new Date("2026-10-20T10:00:00Z"));
  snapshot.products[0] = { ...snapshot.products[0], on_hand: 100, reserved: 20 };
  snapshot.products[1] = { ...snapshot.products[1], on_hand: 50, reserved: 0 };
  snapshot.products.push({ ...snapshot.products[3], id: "disposable", sku: "GC-DIS-001", name: "Disposable Vape", category: "Disposable Vapes", subcategory: "Indica", on_hand: 8, reserved: 3 });
  snapshot.stocks.push({ store_id: "store", franchise_id: "franchise", master_product_id: snapshot.products[0].id, product_id: "store-product", quantity: 900, received_total: 900, sold_total: 0 });
  return snapshot;
}

it("shows six ordered central availability totals, including zero and both vape categories", () => {
  const snapshot = inventory();
  const { rerender } = render(<SupplyInventory snapshot={snapshot} />);
  const cards = within(screen.getByRole("group", { name: "Central stock by category" })).getAllByRole("button");
  expect(cards.map(card => card.getAttribute("aria-label"))).toEqual([
    "Flower: 130 available. Filter inventory",
    "Pre-Rolls: 0 available. Filter inventory",
    "Edibles: 220 available. Filter inventory",
    "Accessories: 120 available. Filter inventory",
    "Concentrates: 160 available. Filter inventory",
    "Vape Cartridges / Disposables: 195 available. Filter inventory",
  ]);
  expect(cards[0].textContent).toContain("130Available");
  rerender(<SupplyInventory snapshot={{ ...snapshot, products: snapshot.products.map(product => product.id === snapshot.products[0].id ? { ...product, on_hand: 110 } : product) }} />);
  expect(screen.getByRole("button", { name: "Flower: 140 available. Filter inventory" })).toBeTruthy();
});

function classifiedInventory() {
  const snapshot = inventory();
  snapshot.products.push({ ...snapshot.products[0], id: "indica-flower", sku: "GC-FLW-IND", name: "Indica Flower", subcategory: "Indica", strain_type: "Indica", cultivation_type: "Indoor" });
  snapshot.products.push({ ...snapshot.products[0], id: "pre-roll", sku: "GC-PR-001", name: "Indica Pre-Roll", category: "Pre-Rolls", subcategory: "Indica", strain_type: null, cultivation_type: "Outdoor" });
  snapshot.products.push({ ...snapshot.products[2], id: "cookie", sku: "GC-EDB-002", name: "Chocolate Cookie", subcategory: "Cookies" });
  return snapshot;
}

const options = (label: string) => within(screen.getByRole("combobox", { name: label })).getAllByRole("option").map(option => option.textContent);

it("defaults to Flower and offers exactly six categories with relevant dependent controls", () => {
  render(<SupplyInventory snapshot={classifiedInventory()} />);
  const category = screen.getByRole("combobox", { name: "Category" }) as HTMLSelectElement;
  expect(category.value).toBe("Flower");
  expect(options("Category")).toEqual(["Flower", "Pre-Rolls", "Edibles", "Accessories", "Concentrates", "Vape Cartridges / Disposables"]);
  expect(options("Subcategory")).toEqual(["All Subcategories", "Sativa", "Indica", "Hybrid"]);
  expect(options("Strain type")).toEqual(["All Strain Types", "Sativa", "Indica", "Hybrid"]);
  expect(options("Cultivation")).toEqual(["All Cultivations", "Indoor", "Greenhouse", "Outdoor"]);
  expect(screen.getByRole("button", { name: /Add Supply/ })).toBeTruthy();
  expect(within(screen.getByRole("table")).getAllByRole("button", { name: "View" })).toHaveLength(3);
  expect(within(screen.getByRole("table")).getAllByRole("button", { name: "Add Stock" })).toHaveLength(3);

  const expected = [
    { category: "Pre-Rolls", rows: 2, subcategories: ["All Subcategories", "Indica"], strain: true, cultivation: false },
    { category: "Edibles", rows: 3, subcategories: ["All Subcategories", "Gummies", "Cookies"], strain: false, cultivation: false },
    { category: "Accessories", rows: 2, subcategories: ["All Subcategories", "Storage / Jars"], strain: false, cultivation: false },
    { category: "Concentrates", rows: 2, subcategories: ["All Subcategories", "Dab"], strain: false, cultivation: false },
    { category: "Vape Cartridges", rows: 3, subcategories: ["All Subcategories", "Vape Cartridge", "Indica"], strain: false, cultivation: false },
    { category: "Flower", rows: 4, subcategories: ["All Subcategories", "Sativa", "Indica", "Hybrid"], strain: true, cultivation: true },
  ];
  for (const item of expected) {
    fireEvent.change(category, { target: { value: item.category } });
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(item.rows);
    expect(options("Subcategory")).toEqual(item.subcategories);
    expect(Boolean(screen.queryByRole("combobox", { name: "Strain type" }))).toBe(item.strain);
    expect(Boolean(screen.queryByRole("combobox", { name: "Cultivation" }))).toBe(item.cultivation);
  }
});

it("combines visible filters and clears hidden values when the category changes", () => {
  render(<SupplyInventory snapshot={classifiedInventory()} />);
  const table = screen.getByRole("table");
  fireEvent.change(screen.getByRole("combobox", { name: "Subcategory" }), { target: { value: "Indica" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Strain type" }), { target: { value: "Indica" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Cultivation" }), { target: { value: "Indoor" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Search products" }), { target: { value: "Indica" } });
  expect(within(table).getAllByRole("row")).toHaveLength(2);
  expect(within(table).getByText("Indica Flower")).toBeTruthy();

  fireEvent.change(screen.getByRole("combobox", { name: "Category" }), { target: { value: "Edibles" } });
  expect((screen.getByRole("combobox", { name: "Subcategory" }) as HTMLSelectElement).value).toBe("");
  expect(screen.queryByRole("combobox", { name: "Strain type" })).toBeNull();
  expect(screen.queryByRole("combobox", { name: "Cultivation" })).toBeNull();
  expect(within(table).getAllByRole("row")).toHaveLength(1);
  fireEvent.change(screen.getByRole("textbox", { name: "Search products" }), { target: { value: "" } });
  expect(within(table).getAllByRole("row")).toHaveLength(3);
  fireEvent.change(screen.getByRole("combobox", { name: "Subcategory" }), { target: { value: "Cookies" } });
  expect(within(table).getAllByRole("row")).toHaveLength(2);
  expect(within(table).getByText("Chocolate Cookie")).toBeTruthy();
  fireEvent.change(screen.getByRole("combobox", { name: "Category" }), { target: { value: "Pre-Rolls" } });
  expect((screen.getByRole("combobox", { name: "Subcategory" }) as HTMLSelectElement).value).toBe("");
  fireEvent.change(screen.getByRole("combobox", { name: "Strain type" }), { target: { value: "Indica" } });
  expect(within(table).getByText("Indica Pre-Roll")).toBeTruthy();
  fireEvent.change(screen.getByRole("combobox", { name: "Category" }), { target: { value: "Flower" } });
  expect((screen.getByRole("combobox", { name: "Strain type" }) as HTMLSelectElement).value).toBe("");
  expect((screen.getByRole("combobox", { name: "Cultivation" }) as HTMLSelectElement).value).toBe("");
  expect(within(table).getAllByRole("row")).toHaveLength(4);
});

it("keeps KPI cards and the required category selection synchronized", () => {
  render(<SupplyInventory snapshot={inventory()} />);
  const category = screen.getByRole("combobox", { name: "Category" }) as HTMLSelectElement;
  const vapes = screen.getByRole("button", { name: "Vape Cartridges / Disposables: 195 available. Filter inventory" });
  fireEvent.click(vapes);
  expect(category.value).toBe("Vape Cartridges");
  expect(vapes.getAttribute("aria-pressed")).toBe("true");
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(3);
  fireEvent.click(vapes);
  expect(category.value).toBe("Flower");
  expect(vapes.getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(screen.getByRole("button", { name: "Clear Filters" }));
  expect(category.value).toBe("Flower");
});

it("hides subcategory when the selected category has none registered", () => {
  const snapshot = inventory();
  const { rerender } = render(<SupplyInventory snapshot={snapshot} />);
  fireEvent.change(screen.getByRole("combobox", { name: "Category" }), { target: { value: "Concentrates" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Subcategory" }), { target: { value: "Dab" } });
  rerender(<SupplyInventory snapshot={{ ...snapshot, products: snapshot.products.map(product => product.category === "Concentrates" ? { ...product, subcategory: "" } : product) }} />);
  expect(screen.queryByRole("combobox", { name: "Subcategory" })).toBeNull();
  expect(within(screen.getByRole("table")).getByText("GreenChoice Balance Concentrate")).toBeTruthy();
});
