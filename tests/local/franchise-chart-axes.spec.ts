import { expect, test } from "@playwright/test";

const money = (value: number) => new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(value);

test("axes follow periods and scales, gridlines align, and zero periods keep every point", async ({ page }) => {
  await page.goto("/dashboard/franchise/sales?chart-test=1");
  const line = page.getByRole("heading", { name: "Axis test revenue", exact: true }).locator("..");
  const bars = page.getByRole("heading", { name: "Axis test stores", exact: true }).locator("..");
  const scenario = page.getByRole("combobox", { name: "Chart scenario" });
  await expect(line.getByRole("img", { name: "Revenue axis in South African rand" })).toBeVisible();
  await expect(bars.getByRole("img", { name: "Revenue axis in South African rand" })).toBeVisible();
  for (const [period, count, title] of [["normal", 13, "Date"], ["weekly", 60, "Week"], ["year", 120, "Month / year"]] as const) {
    await scenario.selectOption(period);
    await expect(line.locator('circle[r="5"]')).toHaveCount(count);
    await expect(line.locator('[class*="xAxisTitle"]')).toHaveText(title);
    expect(await line.locator('[class*="dateTick"] text').count()).toBeLessThan(count);
    const axisYs = await line.locator('[class*="revenueYAxis"] text[y]:not(:first-child)').evaluateAll((elements) => elements.map((el) => Number(el.getAttribute("y"))));
    const gridYs = await line.locator('svg[role="group"] > g[aria-hidden] line').evaluateAll((elements) => elements.map((el) => Number(el.getAttribute("y1"))));
    expect(axisYs).toEqual(gridYs);
  }
  const axisBefore = await line.locator('[class*="revenueYAxis"]').boundingBox();
  await line.locator('[class*="chartScroll"]').evaluate((el) => { el.scrollLeft = 2000; });
  expect(await line.locator('[class*="revenueYAxis"]').boundingBox()).toEqual(axisBefore);
  for (const [period, peak] of [["zero", 0], ["small", .03], ["large", 4730324.1]] as const) {
    await scenario.selectOption(period);
    await expect(line.locator('circle[r="5"]')).toHaveCount(13);
    await expect(line.locator('svg[role="group"]')).toHaveAttribute("aria-label", `Axis test revenue. Peak daily revenue ${money(peak)}.`);
    await expect(line.locator('[class*="revenueYAxis"] text title')).toHaveCount(5);
    const amounts = await line.locator('[class*="pointValue"]').allTextContents();
    expect(amounts).toContain(money(peak));
    if (period === "zero") {
      await expect(line.getByText("No sales in this period.", { exact: true })).toBeVisible();
      const ys = await line.locator('circle[r="5"]').evaluateAll((els) => els.map((el) => el.getAttribute("cy")));
      expect(new Set(ys)).toEqual(new Set(["150"]));
      expect(await bars.locator('rect').evaluateAll((els) => els.every((el) => el.getAttribute("height") === "2"))).toBe(true);
    }
  }
  await page.screenshot({ path: "tmp/chart-axes-large.png", fullPage: true });
});

test("multiple stores stay readable and all bars remain reachable without horizontal scrolling", async ({ page }) => {
  await page.goto("/dashboard/franchise/sales?chart-test=1");
  const bars = page.getByRole("heading", { name: "Axis test stores", exact: true }).locator("..");
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect.poll(async () => bars.locator('[class*="chartFrame"]').evaluate((el) => Math.round(el.getBoundingClientRect().width))).toBeLessThan(width);
    const previous = bars.getByRole("button", { name: "Previous Axis test stores bars" });
    const next = bars.getByRole("button", { name: "Next Axis test stores bars" });
    while (await previous.isEnabled()) await previous.click();
    const seen = new Set<string>();
    for (;;) {
      const names = await bars.locator('[class*="barNames"] span').evaluateAll((els) => els.map((el) => el.getAttribute("title")!));
      names.forEach((name) => seen.add(name));
      expect(await bars.locator('[class*="chartFrame"]').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      const labels = await bars.locator('[class*="pointValue"]').evaluateAll((els) => els.map((el) => {
        const box = el.getBoundingClientRect(); return { left: box.left, right: box.right };
      }));
      for (let i = 1; i < labels.length; i++) expect(labels[i].left).toBeGreaterThan(labels[i - 1].right);
      expect(await bars.locator('[class*="chartFrame"]').evaluate((el) => Math.round(el.getBoundingClientRect().height))).toBe(200);
      if (await next.isDisabled()) break;
      await next.click();
    }
    expect(seen.size).toBe(12);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (width === 390) await page.screenshot({ path: "tmp/chart-axes-mobile.png", fullPage: true });
  }
});
