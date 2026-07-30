import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("ManagerInventoryBrowser", () => {
  it("keeps the manager inventory browser visually aligned without POS checkout behavior", () => {
    const browser = source("components/manager/ManagerInventoryBrowser.tsx");
    const managerData = source("lib/manager/data.ts");
    const demoData = source("lib/admin/demo-store.ts");

    expect(managerData).toContain("product_name, brand, category");
    expect(demoData).toContain("product_name, brand, category");
    expect(browser).toContain('type InventoryView = "manage" | "low-stock"');
    expect(browser).toContain("brandTitle(product)");
    expect(browser).toContain("needsLowStockAttention");
    expect(browser).toContain("lowStockThreshold");
    expect(browser).toContain("const lowStockProducts = useMemo(() => browserProducts.filter(needsLowStockAttention)");
    expect(browser).toContain('inventoryView === "manage" && !hasRequiredFilters');
    expect(browser).toContain("Stock Available");
    expect(browser).toContain("/grams");
    expect(browser).toContain("estimated grams");
    expect(browser).toContain("sm:grid-cols-[repeat(2,minmax(240px,300px))]");
    expect(browser).toContain("lg:grid-cols-[repeat(3,minmax(240px,300px))]");
    expect(browser).toContain('visualStyle="receptionist"');
    expect(browser).not.toContain("border-2 border-white/45");
    expect(browser).not.toContain("border-2 border-emerald-300");
    expect(browser).toContain("Edit Product");
    expect(browser).toContain("Remove from POS");
    expect(browser).toContain("Put Back on POS");
    expect(browser).not.toContain("Add to cart");
    expect(browser).not.toContain("Current Sale");
  });
});
