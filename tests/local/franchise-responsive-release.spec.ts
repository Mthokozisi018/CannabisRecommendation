import { expect, test } from "@playwright/test";

test("Master Supply summary and navigation stay in one tablet row", async ({ page }) => {
  for (const width of [768, 820, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/dashboard/franchise/supply");
    const kpis = page.getByRole("region", { name: "Supply summary" }).locator('[class*="overviewKpi"]');
    const links = page.getByRole("navigation", { name: "Master Supply actions" }).getByRole("link");
    await expect(kpis).toHaveCount(4);
    await expect(links).toHaveCount(4);
    const kpiBoxes = await kpis.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().toJSON()));
    const linkBoxes = await links.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().toJSON()));
    expect(Math.max(...kpiBoxes.map(box => box.top)) - Math.min(...kpiBoxes.map(box => box.top))).toBeLessThan(2);
    expect(Math.max(...linkBoxes.map(box => box.top)) - Math.min(...linkBoxes.map(box => box.top))).toBeLessThan(2);
    for (const box of [...kpiBoxes, ...linkBoxes]) {
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await expect(links).toHaveText([/View Master Inventory/, /Distribute Supply/, /Distribution History/, /Supply Requests/]);
    if (width === 820) await page.screenshot({ path: "tmp/master-supply-820.png", fullPage: true });
  }
});

test("franchise sales KPIs remain one readable row on phones", async ({ page }) => {
  for (const width of [375, 390, 430, 768, 820, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/dashboard/franchise/sales");
    const cards = page.locator('[class*="salesOverview"] [class*="kpisCompact"] > div');
    await expect(cards).toHaveCount(4);
    const boxes = await cards.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().toJSON()));
    expect(Math.max(...boxes.map(box => box.top)) - Math.min(...boxes.map(box => box.top))).toBeLessThan(2);
    for (const box of boxes) {
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    if (width === 390) await page.screenshot({ path: "tmp/franchise-sales-390.png", fullPage: true });
  }
});
