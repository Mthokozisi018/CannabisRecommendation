// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { masterSupplyAction } from "@/app/dashboard/franchise/supply/actions";
import { createSupplyDemoSnapshot } from "@/lib/master-supply/demo-data";
import type { SupplyStore } from "@/lib/master-supply/data";
import { filterSupplyRequests, requestPeriodBounds } from "@/lib/master-supply/request-filters";
import { SupplyRequests } from "@/components/master-supply/SupplyRequests";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/dashboard/franchise/supply/actions", () => ({ masterSupplyAction: vi.fn() }));
afterEach(cleanup);

const stores: SupplyStore[] = [
  { id: "00000000-0000-4000-8000-000000000001", name: "Pretoria East", city: "Pretoria", province: "Gauteng", store_image_url: null, is_active: true, store_access_status: "active" },
  { id: "00000000-0000-4000-8000-000000000002", name: "Centurion", city: "Centurion", province: "Gauteng", store_image_url: "/uploaded-store.png", is_active: true, store_access_status: "active" },
];
const now = new Date("2026-10-20T22:30:00Z"); // 21 October in Johannesburg
const snapshot = () => createSupplyDemoSnapshot("franchise", "actor", stores, now);

it("calculates all periods by Johannesburg calendar boundaries", () => {
  expect(requestPeriodBounds("today", now)).toEqual({ start: "2026-10-21", end: "2026-10-22" });
  expect(requestPeriodBounds("yesterday", now)).toEqual({ start: "2026-10-20", end: "2026-10-21" });
  expect(requestPeriodBounds("this_week", now)).toEqual({ start: "2026-10-19", end: "2026-10-26" });
  expect(requestPeriodBounds("last_week", now)).toEqual({ start: "2026-10-12", end: "2026-10-19" });
  expect(requestPeriodBounds("this_month", now)).toEqual({ start: "2026-10-01", end: "2026-11-01" });
  expect(requestPeriodBounds("last_month", now)).toEqual({ start: "2026-09-01", end: "2026-10-01" });
  expect(requestPeriodBounds("this_year", now)).toEqual({ start: "2026-01-01", end: "2027-01-01" });
  expect(requestPeriodBounds("all_time", now)).toBeNull();
  expect(requestPeriodBounds("yesterday", new Date("2026-01-01T10:00:00Z"))).toEqual({ start: "2025-12-31", end: "2026-01-01" });
});

it("combines store, status, date, and search filters", () => {
  const data = snapshot();
  const request = data.requests[0];
  request.created_at = "2026-10-20T22:15:00Z";
  const filters = { tab: "pending", search: request.id.slice(0, 8), storeId: request.store_id, status: "pending", period: "today" as const };
  expect(filterSupplyRequests(data, filters, now).map(row => row.id)).toEqual([request.id]);
  expect(filterSupplyRequests(data, { ...filters, storeId: stores[1].id }, now)).toEqual([]);
  expect(filterSupplyRequests(data, { ...filters, search: data.products[0].name }, now)).toHaveLength(1);
  expect(filterSupplyRequests(data, { ...filters, period: "yesterday" }, now)).toEqual([]);
});

it("renders six columns, store images, and one inline detail row at a time", () => {
  const data = snapshot();
  render(<SupplyRequests snapshot={data} />);
  const table = screen.getByRole("table", { name: "" });
  expect(within(table).getAllByRole("columnheader").map(header => header.textContent)).toEqual(["Store Name", "Request Date", "Products", "Total Units", "Status", "Actions"]);
  expect(document.querySelector('img[src="/images/franchise/store-default.png"]')).toBeTruthy();
  expect(document.querySelector('img[src="/uploaded-store.png"]')).toBeTruthy();
  expect(screen.queryByText("Request Details")).toBeNull();
  const buttons = screen.getAllByRole("button", { name: "View Details" });
  fireEvent.click(buttons[0]);
  expect(screen.queryByText("Request Details")).toBeNull();
  expect(screen.getByText("Requested Products (1)")).toBeTruthy();
  expect(document.querySelector('[id^="request-details-"]')?.closest("tr")?.previousElementSibling?.textContent).toContain(stores[0].name);
  fireEvent.click(screen.getAllByRole("button", { name: "View Details" })[0]);
  expect(screen.queryByText("Request Details")).toBeNull();
  expect(document.querySelectorAll('[id^="request-details-"]')).toHaveLength(1);
  fireEvent.click(screen.getAllByRole("button", { name: "Close Details" })[0]);
  expect(screen.queryByText("Requested Products (1)")).toBeNull();
});

it("filters from the controls and clears all filters", () => {
  const data = snapshot();
  render(<SupplyRequests snapshot={data} />);
  fireEvent.change(screen.getByRole("combobox", { name: "Date range" }), { target: { value: "last_month" } });
  expect(screen.getByText("No requests match these filters.")).toBeTruthy();
  fireEvent.change(screen.getByRole("combobox", { name: "Date range" }), { target: { value: "all_time" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Store" }), { target: { value: stores[0].id } });
  fireEvent.change(screen.getByRole("combobox", { name: "Status" }), { target: { value: "pending" } });
  expect(screen.getAllByRole("button", { name: "View Details" })).toHaveLength(1);
  fireEvent.change(screen.getByRole("textbox", { name: "Search requests" }), { target: { value: data.requests[0].id } });
  expect(screen.getAllByRole("button", { name: "View Details" })).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Clear Filters" }));
  expect(screen.getAllByRole("button", { name: "View Details" })).toHaveLength(5);
});

it("validates partial quantities and submits request decisions through the existing action", async () => {
  const action = vi.mocked(masterSupplyAction);
  action.mockResolvedValue({ ok: true, id: "saved-request" });
  const data = snapshot();
  render(<SupplyRequests snapshot={data} />);
  fireEvent.click(screen.getAllByRole("button", { name: "View Details" })[0]);
  fireEvent.click(screen.getByRole("button", { name: "Partially Approve" }));
  const quantity = screen.getByRole("spinbutton", { name: /Approve/ });
  fireEvent.change(quantity, { target: { value: "999" } });
  fireEvent.click(screen.getByRole("button", { name: "Save Partial Approval" }));
  expect(screen.getByRole("alert").textContent).toContain("between zero and the requested amount");
  expect(action).not.toHaveBeenCalled();
  fireEvent.change(quantity, { target: { value: "12" } });
  fireEvent.click(screen.getByRole("button", { name: "Save Partial Approval" }));
  await waitFor(() => expect(action).toHaveBeenCalledWith("review_request", {
    requestId: data.requests[0].id, decision: "partial", items: [{ productId: data.requests[0].master_supply_request_items[0].product_id, quantity: 12 }],
  }));
  action.mockClear();
  fireEvent.click(screen.getByRole("button", { name: "Reject Request" }));
  await waitFor(() => expect(action).toHaveBeenCalledWith("review_request", { requestId: data.requests[0].id, decision: "reject", items: [] }));
});

it("shows conversion only for approved requests without a linked distribution", () => {
  const data = snapshot();
  render(<SupplyRequests snapshot={data} />);
  fireEvent.click(screen.getAllByRole("button", { name: "View Details" })[2]);
  expect(screen.getByRole("link", { name: "Convert to Distribution" }).getAttribute("href")).toContain(data.requests[2].id);
  cleanup();
  data.distributions.push({ ...data.distributions[0], id: "linked-distribution", request_id: data.requests[2].id });
  render(<SupplyRequests snapshot={data} />);
  fireEvent.click(screen.getAllByRole("button", { name: "View Details" })[2]);
  expect(screen.queryByRole("link", { name: "Convert to Distribution" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Partially Approve" })).toBeNull();
});
