// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createSupplyDemoSnapshot } from "@/lib/master-supply/demo-data";
import type { SupplyStore } from "@/lib/master-supply/data";
import { SupplyHistory } from "@/components/master-supply/SupplyHistory";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/dashboard/franchise/supply/actions", () => ({ masterSupplyAction: vi.fn() }));
afterEach(cleanup);

const stores: SupplyStore[] = [
  { id: "00000000-0000-4000-8000-000000000001", name: "Pretoria East", city: "Pretoria", province: "Gauteng", store_image_url: null, is_active: true, store_access_status: "active" },
  { id: "00000000-0000-4000-8000-000000000002", name: "Centurion", city: "Centurion", province: "Gauteng", store_image_url: "/uploaded-store.png", is_active: true, store_access_status: "active" },
];
const snapshot = () => createSupplyDemoSnapshot("franchise", "actor", stores, new Date("2026-10-20T12:00:00Z"));

it("shows store images and expands the correct distribution directly beneath its row", () => {
  const data = snapshot();
  render(<SupplyHistory snapshot={data} />);
  const table = screen.getByRole("table", { name: "Distribution history" });
  expect(within(table).getAllByRole("columnheader").map(header => header.textContent)).toEqual([
    "Distribution Date", "Store Name", "Location", "Supply Requested", "Status", "Distributed By", "Received By", "Actions"
  ]);
  expect(table.querySelectorAll("tbody > tr > td:nth-child(2) img").length).toBe(data.distributions.length);
  expect([...table.querySelectorAll("tbody > tr > td:nth-child(2) img")].some(image => image.getAttribute("src")?.endsWith("/images/franchise/store-default.png"))).toBe(true);
  expect([...table.querySelectorAll("tbody > tr > td:nth-child(2) img")].some(image => image.getAttribute("src")?.endsWith("/uploaded-store.png"))).toBe(true);
  expect(within(table).getAllByRole("row")[0].querySelectorAll("th")).toHaveLength(8);

  const first = data.distributions[0];
  const action = within(table).getAllByRole("button", { name: "View Details" })[0];
  fireEvent.click(action);
  expect(action.textContent).toBe("Hide Details");
  expect(action.getAttribute("aria-expanded")).toBe("true");
  const parent = action.closest("tr")!;
  const detailsRow = parent.nextElementSibling as HTMLTableRowElement;
  expect(detailsRow.querySelector("td")?.getAttribute("colspan")).toBe("8");
  const details = within(detailsRow);
  expect(details.queryByText("Distribution date")).toBeNull();
  expect(details.queryByText("Distributed by")).toBeNull();
  const products = details.getByRole("table", { name: `Products in distribution to ${stores.find(store => store.id === first.store_id)!.name}` });
  expect(within(products).getAllByRole("row")).toHaveLength(first.master_supply_distribution_items.length + 1);
  expect(products.querySelectorAll("tbody img")).toHaveLength(first.master_supply_distribution_items.length);
  expect(details.getByText(first.master_supply_distribution_items.reduce((sum, item) => sum + item.quantity, 0).toLocaleString("en-ZA"))).toBeTruthy();
  expect(details.getByText("Total recorded distribution cost")).toBeTruthy();
  expect(parent.textContent).toContain(first.status.replace("_", " ").replace(/^./, letter => letter.toUpperCase()));
  fireEvent.click(action);
  expect(action.textContent).toBe("View Details");
  expect(parent.nextElementSibling?.querySelector("table")).toBeNull();
});

it("shows Yes without the request number and keeps statuses unchanged", () => {
  const data = snapshot();
  render(<SupplyHistory snapshot={data} />);
  const table = screen.getByRole("table", { name: "Distribution history" });
  const actions = within(table).getAllByRole("button", { name: "View Details" });
  const linkedIndex = data.distributions.findIndex(row => row.request_id);
  fireEvent.click(actions[linkedIndex]);
  expect(within(actions[linkedIndex].closest("tr")!).getByText("Yes")).toBeTruthy();
  expect(actions[linkedIndex].closest("tr")?.textContent).not.toContain(data.distributions[linkedIndex].request_id!.slice(0, 8).toUpperCase());
  expect(within(actions[linkedIndex].closest("tr")!.nextElementSibling as HTMLElement).queryByText("Supply request")).toBeNull();
  fireEvent.click(actions[linkedIndex]);
  const directIndex = data.distributions.findIndex(row => !row.request_id);
  fireEvent.click(actions[directIndex]);
  expect(actions[directIndex].closest("tr")?.textContent).toContain("No");
  expect(data.distributions[directIndex].status).toBe("delivered");
});

it("applies a custom range and resets all filters", () => {
  const data = snapshot();
  render(<SupplyHistory snapshot={data} />);
  fireEvent.change(screen.getByRole("combobox", { name: "Date range" }), { target: { value: "custom" } });
  fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-10-17" } });
  fireEvent.change(screen.getByLabelText("To date"), { target: { value: "2026-10-20" } });
  fireEvent.click(screen.getByRole("button", { name: "Apply Range" }));
  expect((screen.getByRole("combobox", { name: "Date range" }) as HTMLSelectElement).value).toBe("custom");
  fireEvent.click(screen.getByRole("button", { name: "Clear Filters" }));
  expect((screen.getByRole("combobox", { name: "Date range" }) as HTMLSelectElement).value).toBe("all_time");
  expect(screen.queryByLabelText("From date")).toBeNull();
});

it("falls back from a broken store image and shows uploaded product images", () => {
  const data = snapshot();
  data.products[0].image_url = "/uploaded-product.png";
  const { container } = render(<SupplyHistory snapshot={data} />);
  const uploadedStore = [...container.querySelectorAll("tbody > tr > td:nth-child(2) img")].find(image => image.getAttribute("src")?.endsWith("/uploaded-store.png"))!;
  fireEvent.error(uploadedStore);
  expect(uploadedStore.getAttribute("src")).toMatch(/\/images\/franchise\/store-default\.png$/);
  fireEvent.click(screen.getAllByRole("button", { name: "View Details" })[0]);
  const detailImages = screen.getByRole("table", { name: /Products in distribution/ }).querySelectorAll("tbody img");
  expect([...detailImages].some(image => image.getAttribute("src")?.endsWith("/uploaded-product.png"))).toBe(true);
  expect([...detailImages].some(image => image.getAttribute("src")?.includes("/images/placeholders/"))).toBe(true);
});
