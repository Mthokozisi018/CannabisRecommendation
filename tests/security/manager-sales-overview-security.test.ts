import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) { return readFileSync(resolve(process.cwd(), path), "utf8"); }

describe("Manager Sales Overview security contracts", () => {
  it("protects refresh and export with origin, manager session, and rate limits", () => {
    for (const path of ["app/dashboard/manager/sales/actions.ts", "app/api/dashboard/manager/sales/export/route.ts"]) {
      const contents = source(path);
      expect(contents).toContain("verifyOrigin()");
      expect(contents).toContain("requireCompletedManagerDashboardSession()");
      expect(contents).toContain("assertRateLimit(");
      expect(contents).toContain("session.isManager");
    }
  });

  it("uses the authenticated RLS client and derives every scope from the session", () => {
    const service = source("lib/manager/sales-overview.ts");
    expect(service).toContain("createSupabaseServerClient()");
    expect(service).not.toContain("createSupabaseAdminClient");
    expect(service).toContain("const storeId = session.assignedStoreId");
    expect(service).toContain('.from("pos_sales")');
    expect(service).toContain('.eq("store_id", storeId)');
    expect(service).toContain('.eq("status", "completed")');
    expect(service).toContain('.from("pos_sale_items")');
    expect(service).toContain('.in("sale_id", saleIds.slice');
  });

  it("does not accept a browser store ID and re-queries export rows server-side", () => {
    const service = source("lib/manager/sales-overview.ts");
    const route = source("app/api/dashboard/manager/sales/export/route.ts");
    expect(service).toContain(".strict()");
    expect(service).not.toMatch(/storeId:\s*z\./);
    expect(route).toContain("getManagerSalesReport(session, await request.json(), { includeAll: true })");
    expect(route).not.toContain("searchParams");
    expect(route).toContain('"Cache-Control": "private, no-store, max-age=0"');
    expect(route).toContain('"Content-Type": "application/pdf"');
    expect(route).toContain('"X-Content-Type-Options": "nosniff"');
  });

  it("opts Sales Overview into only the real manager dashboard", () => {
    const actions = source("components/manager/ManagerDashboardActions.tsx");
    const managerPage = source("app/dashboard/manager/page.tsx");
    const demoPage = source("app/dashboard/admin/demo-store/manager/page.tsx");
    expect(actions).toContain("includeSales = false");
    expect(managerPage).toContain("<ManagerDashboardActions includeSales />");
    expect(demoPage).not.toContain("includeSales");
  });
});
