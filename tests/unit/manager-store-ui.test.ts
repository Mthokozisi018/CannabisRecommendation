import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("manager store UI", () => {
  it("adds Manage Store to the existing manager account dropdown in the requested order", () => {
    const menu = source("components/account/DashboardAccountMenu.tsx");
    const manageStore = menu.indexOf("Manage Store");
    const manageAccount = menu.indexOf("Manage Account");
    const logout = menu.indexOf("Log Out");

    expect(menu).toContain('role === "manager"');
    expect(menu).toContain('href="/dashboard/manager/store"');
    expect(manageStore).toBeGreaterThan(-1);
    expect(manageAccount).toBeGreaterThan(manageStore);
    expect(logout).toBeGreaterThan(manageAccount);
  });

  it("keeps store management on its own manager-only page using existing schema fields", () => {
    const page = source("app/dashboard/manager/store/page.tsx");
    const form = source("components/manager/ManagerStoreForm.tsx");

    expect(page).toContain("requireCompletedManagerDashboardSession()");
    expect(page).toContain("getOwnManagerStoreSettings(session)");
    expect(form).toContain("Store Details");
    expect(form).toContain("Opening Hours");
    expect(form).toContain("Fulfillment Settings");
    expect(form).toContain('name="collectionLeadMinutes"');
    expect(form).toContain('name="deliveryRadiusKm"');
  });
});
