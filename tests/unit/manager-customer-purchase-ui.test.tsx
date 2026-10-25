// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({ loadCustomers: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a> }));
vi.mock("@/components/DashboardBackdrop", () => ({ DashboardBackdrop: () => null }));
vi.mock("@/components/receptionist/pos/TransactionWorkspace", () => ({ TransactionDetailsButton: () => null }));
vi.mock("@/app/dashboard/manager/sales/actions", () => ({
  refreshManagerSalesReport: vi.fn(),
  refreshManagerCustomerPurchaseOverview: mocks.loadCustomers
}));

import { ManagerSalesOverviewUI } from "@/components/manager/ManagerSalesOverviewUI";
import type { ManagerSalesReport } from "@/lib/manager/sales-overview";

const report: ManagerSalesReport = {
  filters: { month: "2026-10", week: "all", receptionist: "all", category: "all", search: "", page: 1 },
  periodLabel: "October 2026", weeks: [], receptionistOptions: [], categoryOptions: [],
  summary: { uniqueCustomers: 1, revenue: 100, transactionCount: 1 },
  kpis: { revenueThisWeek: 100, revenueThisMonth: 100, revenueThisYear: 100, currentWeekLabel: "Week", currentMonthLabel: "Month", currentYearLabel: "2026" },
  transactions: [], totalTransactions: 0, totalPages: 1, emptyReason: null
};

afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("places View Customers only in the fourth KPI and opens a paged customer modal without navigation", async () => {
  mocks.loadCustomers.mockResolvedValue({ ok: true, overview: {
    rows: [{ customerId: "customer-a", name: "Thabo", surname: "Mokoena", phoneNumber: "072 123 4567", timesPurchased: 2, totalSpent: 100 }],
    totalCustomers: 1, matchingCustomers: 1, page: 1, totalPages: 1
  } });
  const user = userEvent.setup();
  render(<ManagerSalesOverviewUI initialReport={report} storeName="Test Store" managerName="Test Manager" />);
  const kpis = screen.getByRole("region", { name: "Sales KPIs" });
  const cards = Array.from(kpis.children) as HTMLElement[];
  expect(cards).toHaveLength(5);
  expect(within(cards[3]).getByRole("button", { name: "View Customers" }).getAttribute("title")).toBe("View Customers");
  expect(within(cards[0]).queryByRole("button")).toBeNull();

  await user.click(within(cards[3]).getByRole("button", { name: "View Customers" }));
  const dialog = await screen.findByRole("dialog", { name: "Customer Purchase Overview" });
  await waitFor(() => expect(within(dialog).getByText("Thabo")).toBeTruthy());
  expect(within(dialog).getAllByRole("columnheader").map((header) => header.textContent?.trim())).toEqual([
    "Name", "Surname", "Phone Number", "Times Purchased", "Total Spent"
  ]);
  expect(within(dialog).getByRole("button", { name: "Times Purchased" }).querySelector("svg")).toBeNull();
  expect(within(dialog).getByRole("button", { name: "Total Spent" }).querySelector("svg")).toBeNull();
  expect(within(dialog).getByRole("button", { name: "Previous" }).querySelector("svg")).toBeNull();
  expect(within(dialog).getByRole("button", { name: "Next" }).querySelector("svg")).toBeNull();
  expect(mocks.loadCustomers).toHaveBeenCalledWith(expect.objectContaining({ filters: report.filters, page: 1 }));
  await user.click(within(dialog).getByRole("button", { name: "Close customer purchase overview" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByRole("main", { name: "Manager Sales Overview" })).toBeTruthy();
});
