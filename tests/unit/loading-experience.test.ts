import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("continuous dashboard loading experience", () => {
  it("keeps the navigation overlay until the route changes", () => {
    const overlay = source("components/NavigationLoadingOverlay.tsx");
    expect(overlay).toContain("visibleForRouteKey !== routeKey");
    expect(overlay).toContain("navigationTimedOut");
    expect(overlay).toContain("This page is taking longer than expected.");
    expect(overlay).not.toContain("setTimeout(hide");
  });

  it("provides route loading and error boundaries for affected dashboards", () => {
    for (const path of [
      "app/dashboard/manager/loading.tsx",
      "app/dashboard/manager/error.tsx",
      "app/dashboard/receptionist/loading.tsx",
      "app/dashboard/receptionist/error.tsx",
      "app/dashboard/manager/sales/loading.tsx",
      "app/dashboard/manager/sales/error.tsx"
    ]) {
      expect(source(path).length).toBeGreaterThan(40);
    }
  });
});
