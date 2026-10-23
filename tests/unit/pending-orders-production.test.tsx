import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ManagerDashboardActions } from "@/components/manager/ManagerDashboardActions";
import { pendingOrdersUiEnabled } from "@/lib/manager/pending-orders-availability";

describe("Pending Orders production exclusion", () => {
  it("defaults off in production and requires explicit release", () => {
    expect(pendingOrdersUiEnabled({ GREENCHOICE_ENV: "production" })).toBe(false);
    expect(pendingOrdersUiEnabled({ VERCEL_ENV: "production" })).toBe(false);
    expect(pendingOrdersUiEnabled({ GREENCHOICE_ENV: "production", GREENCHOICE_PENDING_ORDERS_ENABLED: "false" })).toBe(false);
    expect(pendingOrdersUiEnabled({ GREENCHOICE_ENV: "production", GREENCHOICE_PENDING_ORDERS_ENABLED: "true" })).toBe(true);
    expect(pendingOrdersUiEnabled({ GREENCHOICE_ENV: "staging" })).toBe(true);
  });

  it("removes only the Pending Orders navigation card", () => {
    const hidden = renderToStaticMarkup(<ManagerDashboardActions pendingOrdersEnabled={false} />);
    expect(hidden).not.toContain("Pending Orders");
    expect(hidden).not.toContain("/dashboard/manager/orders");
    expect(hidden).toContain("Manage Inventory");
    expect(hidden).toContain("Sales Overview");
    const enabled = renderToStaticMarkup(<ManagerDashboardActions pendingOrdersEnabled />);
    expect(enabled).toContain("Pending Orders");
  });
});
