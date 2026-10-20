import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("pending orders user interface", () => {
  it("adds the counted manager dashboard action and store-scoped page", () => {
    const cards = source("components/manager/ManagerDashboardActions.tsx");
    const dashboard = source("app/dashboard/manager/page.tsx");
    const page = source("app/dashboard/manager/orders/page.tsx");
    expect(cards).toContain('title: "Pending Orders"');
    expect(cards).toContain('href: "/dashboard/manager/orders"');
    expect(cards).toContain("pendingOrderCount");
    expect(dashboard).toContain("countManagerPendingOrders(session)");
    expect(page).toContain("requireCompletedManagerDashboardSession()");
    expect(page).toContain("listManagerPendingOrders(session)");
  });

  it("matches the required controls, actions, confirmation, and empty state", () => {
    const ui = source("components/manager/ManagerPendingOrdersUI.tsx");
    expect(ui).toContain("Search by name, phone or order number...");
    expect(ui).toContain("All Payment Methods");
    expect(ui).toContain("Sort by: Newest");
    expect(ui).toContain("No pending orders");
    expect(ui).toContain("Forfeit Order");
    expect(ui).toContain("Confirm Sale");
    expect(ui).toContain('role="dialog"');
    expect(ui).not.toContain("What happens next?");
  });

  it("provides a portrait layout and a shared customer Orders destination", () => {
    const css = source("app/globals.css");
    const shell = source("components/customer/CustomerShell.tsx");
    const checkout = source("components/customer/CustomerCheckout.tsx");
    const ui = source("components/manager/ManagerPendingOrdersUI.tsx");
    expect(css).toContain("@media (orientation: portrait) and (max-width: 1024px)");
    expect(css).toContain(".gc-pending-orders-layout");
    expect(shell).toContain("CustomerBottomNavigation");
    expect(source("lib/customer/navigation.ts")).toContain('{ href: "/customer/orders", label: "Orders"');
    expect(checkout).toContain("placeCustomerOrderAction");
    expect(checkout).toContain("Place Order");
    expect(ui).toContain("Available after four days");
    expect(ui).toContain("selected.forfeitEligible");
  });
});
