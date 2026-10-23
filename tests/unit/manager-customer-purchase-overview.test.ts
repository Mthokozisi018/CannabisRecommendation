import { expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildManagerSalesReport, parseSalesReportFilters, type SalesReportSource } from "@/lib/manager/sales-overview";
import { buildCustomerPurchaseOverview } from "@/lib/manager/customer-purchase-overview";

const filters = parseSalesReportFilters({ month: "2026-10" }, new Date("2026-10-21T10:00:00Z"));
const source: SalesReportSource = {
  sales: [
    { id: "a", checkout_id: "A", customer_id: "customer-a", staff_user_id: "staff-a", total: 100, refunded_amount: 0, created_at: "2026-10-02T08:00:00Z" },
    { id: "b", checkout_id: "B", customer_id: "customer-a", staff_user_id: "staff-a", total: 40, refunded_amount: 40, created_at: "2026-10-02T09:00:00Z" },
    { id: "c", checkout_id: "C", customer_id: "customer-b", staff_user_id: "staff-b", total: 80, refunded_amount: 25, created_at: "2026-10-12T08:00:00Z" },
    { id: "d", checkout_id: "D", customer_id: null, staff_user_id: "staff-a", total: 50, refunded_amount: 0, created_at: "2026-10-12T09:00:00Z" }
  ],
  items: [
    { sale_id: "a", product_name_snapshot: "Flower", category_snapshot: "Flower", subcategory_snapshot: null, unit_price: 60, quantity: 1, line_total: 60 },
    { sale_id: "a", product_name_snapshot: "Gummies", category_snapshot: "Edibles", subcategory_snapshot: null, unit_price: 40, quantity: 1, line_total: 40 },
    { sale_id: "b", product_name_snapshot: "Flower", category_snapshot: "Flower", subcategory_snapshot: null, unit_price: 40, quantity: 1, line_total: 40 },
    { sale_id: "c", product_name_snapshot: "Flower", category_snapshot: "Flower", subcategory_snapshot: null, unit_price: 80, quantity: 1, line_total: 80 }
  ],
  customers: [
    { id: "customer-a", first_name: "Thabo", surname: "Mokoena", full_name: "Thabo Mokoena", phone_display: "072 123 4567", phone_normalized: "+27721234567" },
    { id: "customer-b", first_name: "Lerato", surname: "Nkosi", full_name: "Lerato Nkosi", phone_display: "083 987 6543", phone_normalized: "+27839876543" }
  ],
  staff: [
    { auth_user_id: "staff-a", user_id: null, full_name: "Anele", first_name: null, surname: null, email: null },
    { auth_user_id: "staff-b", user_id: null, full_name: "Sipho", first_name: null, surname: null, email: null }
  ]
};

it("counts each qualifying checkout once and matches the Total Customers KPI after refunds", () => {
  const report = buildManagerSalesReport(source, filters, true);
  const overview = buildCustomerPurchaseOverview(report.transactions, { search: "", sort: "purchases_desc", page: 1 });
  expect(report.summary.uniqueCustomers).toBe(2);
  expect(overview.totalCustomers).toBe(report.summary.uniqueCustomers);
  expect(overview.rows).toEqual([
    { customerId: "customer-a", name: "Thabo", surname: "Mokoena", phoneNumber: "072 123 4567", timesPurchased: 1, totalSpent: 100 },
    { customerId: "customer-b", name: "Lerato", surname: "Nkosi", phoneNumber: "083 987 6543", timesPurchased: 1, totalSpent: 55 }
  ]);
});

it("inherits week, receptionist, category and report search filters before customer search", () => {
  const report = buildManagerSalesReport(source, { ...filters, week: "2026-10-01", receptionist: "Anele", category: "Edibles", search: "gummies" }, true);
  const overview = buildCustomerPurchaseOverview(report.transactions, { search: "072123", sort: "spent_desc", page: 1 });
  expect(report.summary.uniqueCustomers).toBe(1);
  expect(overview.rows).toMatchObject([{ customerId: "customer-a", timesPurchased: 1, totalSpent: 100 }]);
});

it("sorts and paginates on the server without sending every customer row", () => {
  const transactions = Array.from({ length: 25 }, (_, index) => ({
    ...buildManagerSalesReport(source, filters, true).transactions[0],
    saleId: `sale-${index}`, customerId: `customer-${index}`,
    customerFirstName: `Name${index}`, customerSurname: `Surname${index}`,
    recordedTotal: index + 1, refundedAmount: 0
  }));
  const first = buildCustomerPurchaseOverview(transactions, { search: "", sort: "spent_desc", page: 1 });
  const second = buildCustomerPurchaseOverview(transactions, { search: "", sort: "spent_desc", page: 2 });
  expect(first.totalCustomers).toBe(25);
  expect(first.rows).toHaveLength(20);
  expect(first.rows[0].totalSpent).toBe(25);
  expect(second.rows).toHaveLength(5);
  expect(second.rows[0].totalSpent).toBe(5);
});
