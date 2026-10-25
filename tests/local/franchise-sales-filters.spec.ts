import { test, expect } from "@playwright/test";
const money = (value: number) => new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(value);
const region = (page: import("@playwright/test").Page, name: string) => page.getByRole("region", { name, exact: true });

test("a stalled period fetch releases the spinner and retries with a fresh request", async ({ page }) => {
  await page.clock.install();
  let held: import("@playwright/test").Route | undefined;
  let attempts = 0;
  await page.route("**/fixture-period", async (route) => {
    if (route.request().postDataJSON().from === "2024-02-01" && ++attempts === 1) { held = route; return; }
    await route.continue();
  });
  await page.goto("/dashboard/franchise/sales");
  const revenue = region(page, "Franchise Revenue");
  await revenue.getByLabel("Franchise Revenue period", { exact: true }).selectOption("years");
  await expect(page.getByRole("status", { name: "Loading franchise revenue report", exact: true })).toBeVisible();
  await page.clock.fastForward(120000);
  await expect(page.getByRole("status", { name: "Loading franchise revenue report", exact: true })).toHaveCount(0);
  await expect(revenue.getByRole("alert")).toContainText("could not be loaded");
  await revenue.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(revenue.getByText("Annual Revenue \u2014 All Available Years", { exact: true })).toBeVisible();
  expect(attempts).toBe(2);
  await held?.abort();
});

test("Days, Weeks, Months and Years aggregate correctly and render every calendar label", async ({ page }) => {
  await page.goto("/dashboard/franchise/sales");
  const revenue = region(page, "Franchise Revenue");
  const view = revenue.getByLabel("Franchise Revenue period", { exact: true });
  const year = revenue.getByLabel("Reporting year", { exact: true });
  const month = revenue.getByLabel("Reporting month", { exact: true });
  await expect(view.locator("option")).toHaveText(["Days", "Weeks", "Months", "Years"]);
  await expect(revenue.getByText("Monthly Revenue \u2014 2026", { exact: true })).toBeVisible();
  await expect(revenue.locator('[class*="dateTick"] text')).toHaveText(["January", "February", "March", "April", "May", "June", "July", "August", "September", "October"]);
  await expect(revenue.locator('circle[r="5"]')).toHaveCount(10);
  await expect(revenue.getByRole("button", { name: /October:.*R/ })).toHaveAttribute("aria-label", new RegExp(money(148.85)));
  await expect(revenue.locator('[class*="xAxisTitle"]')).toHaveText("Month");
  await expect(year).toHaveCount(0);
  await expect(month).toHaveCount(0);
  await expect(revenue.getByRole("combobox")).toHaveCount(1);
  expect((await view.boundingBox())?.width).toBe(160);
  await view.selectOption("days");
  await expect(revenue.locator('[class*="dateTick"] text')).toHaveCount(13);
  await expect(revenue.locator('circle[r="5"]')).toHaveCount(13);
  await expect(revenue.locator('[class*="xAxisTitle"]')).toHaveText("Day");
  const lastPoint = revenue.getByRole("button", { name: /Day 13:.*25,10/ });
  await lastPoint.hover();
  await expect(revenue.getByRole("tooltip")).toContainText("13 Oct 2026");
  await expect(revenue.getByRole("tooltip")).toContainText(money(25.1));
  await lastPoint.click(); await lastPoint.press("Escape");
  await expect(revenue.getByRole("tooltip")).toHaveCount(0);
  await lastPoint.press("Enter"); await expect(revenue.getByRole("tooltip")).toBeVisible();
  await lastPoint.press("Escape");
  await view.selectOption("weeks");
  await expect(revenue.getByText("Weekly Revenue \u2014 2026", { exact: true })).toBeVisible();
  await expect(revenue.locator('[class*="dateTick"] text')).toHaveCount(42);
  await expect(revenue.locator('circle[r="5"]')).toHaveCount(42);
  await expect(revenue.getByRole("button", { name: /Week 42:.*148,85/ })).toHaveCount(1);
  await expect(revenue.locator('[class*="xAxisTitle"]')).toHaveText("Week");
  await view.selectOption("years");
  await expect(revenue.locator('[class*="dateTick"] text')).toHaveText(["2024", "2025", "2026"]);
  await expect(revenue.locator('[class*="pointValue"]')).toHaveText([money(0), money(30), money(1576775)]);
  await expect(revenue.locator('[class*="xAxisTitle"]')).toHaveText("Year");
  await expect(year).toHaveCount(0);
});

test("matched store ranges reconcile, retain navigation and filters, and keep all labels readable", async ({ page }) => {
  await page.goto("/dashboard/franchise/sales");
  const revenue = region(page, "Franchise Revenue"), stores = region(page, "Sales by Store"), table = region(page, "Store Performance");
  const cards = page.locator('[class*="kpisCompact"]');
  const kpis = await cards.innerText();
  await revenue.getByLabel("Franchise Revenue period", { exact: true }).selectOption("years");
  await expect(revenue.locator('[class*="pointValue"]')).toHaveCount(3);
  await expect(stores.getByRole("button", { name: "Use revenue range" })).toHaveCount(0);
  await stores.getByLabel("Sales by Store period", { exact: true }).selectOption("custom");
  await stores.getByLabel("Sales by Store from", { exact: true }).fill("2024-01-01");
  await stores.getByLabel("Sales by Store to", { exact: true }).fill("2026-10-13");
  await stores.getByRole("button", { name: "Apply", exact: true }).click();
  await table.getByRole("button", { name: "Use revenue range" }).click();
  await expect(table.getByLabel("Store revenue period", { exact: true })).toHaveValue("custom");
  await expect(table.getByRole("row").filter({ hasText: "Alpha Store" })).toContainText(money(1576784.7));
  await expect(table.getByRole("row").filter({ hasText: "Beta Store" })).toContainText(money(20.3));
  await expect(stores.locator('[class*="pointValue"]')).toHaveText([money(1576784.7), money(20.3)]);
  await table.getByRole("link").first().click();
  await expect(page).toHaveURL(/sales\/a\?from=2024-02-01&to=2026-10-13$/);
  await expect(page.getByRole("heading", { name: "Individual Store Performance", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Back to Sales Overview" }).click();
  await expect(revenue.getByLabel("Franchise Revenue period", { exact: true })).toHaveValue("years");
  await expect(revenue.locator('[class*="pointValue"]')).toHaveText([money(0), money(30), money(1576775)]);
  await expect(table.getByRole("row").filter({ hasText: "Alpha Store" })).toContainText(money(1576784.7));
  await expect(cards).toHaveText(kpis, { useInnerText: true });
  await revenue.getByLabel("Franchise Revenue period", { exact: true }).selectOption("days");
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(revenue.locator('[class*="dateTick"] text')).toHaveCount(13);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await revenue.locator('[class*="chartScroll"]').evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
    const labels = await revenue.locator('[class*="pointValue"]').evaluateAll(els => els.map(el => {
      const box = (el as SVGGraphicsElement).getBBox(); return { left: box.x, right: box.x + box.width };
    }));
    for (let i = 1; i < labels.length; i++) expect(labels[i].left).toBeGreaterThan(labels[i - 1].right);
    expect(labels[0].left).toBeGreaterThanOrEqual(0);
    await revenue.locator('[class*="chartScroll"]').evaluate(el => { el.scrollLeft = el.scrollWidth; });
    await expect(revenue.locator('[class*="dateTick"] text').last()).toBeVisible();
    if (width === 1440 || width === 390) await page.screenshot({ path: `tmp/revenue-reporting-${width}.png`, fullPage: true });
  }
});

test("filter loading, failure/retry, late responses and KPI stability", async ({ page }) => {
  await page.goto("/dashboard/franchise/sales");
  const revenue = region(page, "Franchise Revenue");
  const cards = page.locator('[class*="kpisCompact"]'); const kpis = await cards.innerText();
  const view = revenue.getByLabel("Franchise Revenue period", {exact:true});
  await view.selectOption("days");
  await expect(revenue.getByText("Daily Revenue \u2014 October 2026", {exact:true})).toBeVisible();
  let held: import("@playwright/test").Route | undefined;
  let failed = false;
  await page.route("**/fixture-period", async route => {
    const range = route.request().postDataJSON();
    if (range.from === "2025-12-29") { held = route; return; }
    if (range.from === "2024-02-01" && !failed) { failed = true; await route.fulfill({status:503}); return; }
    await route.continue();
  });
  await view.selectOption("weeks");
  await expect.poll(() => Boolean(held)).toBe(true);
  await expect(page.getByRole("status", {name:"Loading franchise revenue report",exact:true})).toBeVisible();
  await view.selectOption("years");
  await expect(revenue.getByRole("alert")).toContainText("could not be loaded");
  await held!.fulfill({json:{from:"2025-12-29",to:"2026-10-13",daily:[]}});
  await expect(revenue.getByText("Daily Revenue \u2014 October 2026", {exact:true})).toBeVisible();
  await revenue.getByRole("button", {name:"Retry",exact:true}).click();
  await expect(revenue.getByText("Annual Revenue \u2014 All Available Years", {exact:true})).toBeVisible();
  await expect(revenue.locator('[class*="pointValue"]')).toHaveText([0,30,1576775].map(money));
  await expect(cards).toHaveText(kpis, { useInnerText: true });
});


test("expanded revenue labels every recorded point, stays readable and restores keyboard focus", async ({ page }) => {
  test.setTimeout(60000);
  await page.goto("/dashboard/franchise/sales");
  const revenue = region(page, "Franchise Revenue");
  const expand = page.getByRole("button", { name: "Expand franchise revenue graph", exact: true });
  const dialog = page.getByRole("dialog", { name: "Franchise Revenue", exact: true });
  const kpis = page.locator('[class*="kpisCompact"]');
  const labels = await kpis.locator("p").allTextContents();
  expect(labels).toEqual(["Revenue This Week", "Revenue This Month", "Revenue This Year", "Total Customers"]);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 850 });
    await expand.click();
    await expect(dialog).toBeVisible();
    const view = dialog.getByLabel("Franchise Revenue period", { exact: true });
    await expect(view.locator("option")).toHaveText(["Days", "Weeks", "Months", "Years"]);
    expect((await view.boundingBox())?.width).toBe(150);
    for (const period of ["days", "weeks", "months", "years"]) {
      await view.selectOption(period);
      await expect(dialog.getByRole("combobox")).toHaveCount(1);
      await expect(dialog.getByLabel("Reporting year", { exact: true })).toHaveCount(0);
      await expect(dialog.getByLabel("Reporting month", { exact: true })).toHaveCount(0);
      const axis = {days: "Day", weeks: "Week", months: "Month", years: "Year"}[period];
      await expect(dialog.locator('[class*="xAxisTitle"]')).toHaveText(axis!);
      const pointLabels = dialog.locator('[class*="pointValue"]');
      const inlineLabels = revenue.locator("section").first().locator('[class*="pointValue"]');
      await expect(pointLabels).toHaveText(await inlineLabels.allTextContents());
      expect(await pointLabels.count()).toBe(await dialog.locator('circle[r="5"]').count());
      // Inspect actual SVG layout, not just DOM presence: edge labels and peaks
      // must fit the viewBox, adjacent amounts must not collide, and labels
      // must sit above their corresponding markers without swallowing input.
      const geometry = await pointLabels.evaluateAll(elements => elements.map(element => {
        const text = element as SVGTextElement;
        const box = text.getBBox();
        const svg = text.ownerSVGElement!;
        const marker = text.parentElement!.querySelector('circle')!;
        const style = getComputedStyle(text);
        return { left: box.x, right: box.x + box.width, top: box.y, bottom: box.y + box.height,
          width: svg.viewBox.baseVal.width, height: svg.viewBox.baseVal.height,
          markerX: Number(marker.getAttribute('cx')), markerY: Number(marker.getAttribute('cy')),
          center: Number(text.getAttribute('x')), opacity: style.opacity, visibility: style.visibility,
          weight: Number(style.fontWeight), pointerEvents: style.pointerEvents };
      }));
      for (let index = 0; index < geometry.length; index++) {
        const label = geometry[index];
        expect(label.left).toBeGreaterThanOrEqual(0);
        expect(label.right).toBeLessThanOrEqual(label.width);
        expect(label.top).toBeGreaterThanOrEqual(0);
        expect(label.bottom).toBeLessThan(label.markerY);
        expect(label.center).toBe(label.markerX);
        expect(label.opacity).toBe("1"); expect(label.visibility).toBe("visible");
        expect(label.weight).toBeGreaterThanOrEqual(700);
        expect(label.pointerEvents).toBe("none");
        if (index) expect(label.left).toBeGreaterThan(geometry[index - 1].right);
      }
      const scroller = dialog.locator('[class*="chartScroll"]');
      await scroller.evaluate(el => { el.scrollLeft = 0; });
      await expect(pointLabels.first()).toBeInViewport();
      await pointLabels.last().scrollIntoViewIfNeeded();
      await expect(pointLabels.last()).toBeInViewport();
      const inlineValues = await revenue.locator("section").first().locator('circle[role="button"]').evaluateAll(els => els.map(el => el.getAttribute("aria-label")));
      const modalValues = await dialog.locator('circle[role="button"]').evaluateAll(els => els.map(el => el.getAttribute("aria-label")));
      expect(modalValues).toEqual(inlineValues);
      if (period === "days" && width === 1440) await expect(pointLabels).toHaveCount(13); // Future days 14-31 are not zero results.
      await expect(dialog.getByRole("img", { name: "Revenue axis in South African rand" })).toBeVisible();
      await page.mouse.move(0, 0);
      await dialog.locator('circle[role="button"]').last().hover();
      await expect(dialog.getByRole("tooltip")).toContainText("R");
      await dialog.locator('circle[role="button"]').last().focus();
      await expect(dialog.getByRole("tooltip")).toContainText("R");
      await page.mouse.move(0, 0);
      await dialog.getByLabel("Franchise Revenue period", { exact: true }).focus();
      if (width === 1440) {
        await pointLabels.last().scrollIntoViewIfNeeded();
        await dialog.screenshot({ path: `tmp/revenue-labels-${period}-desktop.png` });
      }
    }
    await view.selectOption("days");
    await dialog.getByRole("button", { name: "Close expanded revenue graph" }).click();
    await expand.click();
    await expect(dialog.locator('circle[r="5"]')).toHaveCount(13);
    await expect(dialog.locator('[class*="pointValue"]')).toHaveText([...Array(11).fill(money(0)), money(123.75), money(25.1)]);
    await expect(dialog.getByText("Daily Revenue \u2014 October 2026", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Close expanded revenue graph" }).focus();
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    if (width === 1440 || width === 390) await page.screenshot({ path: `tmp/revenue-expanded-${width}.png` });
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(expand).toBeFocused();
    await expect(revenue.getByRole("combobox")).toHaveValue("days");
    await expand.click();
    await dialog.getByRole("button", { name: "Close expanded revenue graph" }).click();
    await expect(dialog).not.toBeVisible();
  }
});


test("store performance matches the seven-column design, synchronizes periods and remains accessible at every width", async ({ page }) => {
  await page.goto("/dashboard/franchise/sales");
  const table = region(page, "Store Performance");
  const results = table.getByRole("table");
  await expect(results.getByRole("columnheader")).toHaveCount(7);
  const headers = await results.getByRole("columnheader").allTextContents();
  expect(headers.map(text => text.trim())).toEqual(["Store", "Store Manager", "Location", "RevenueDailyWeeklyMonthlyYearly", "Status", "Date Registered", "Actions"]);
  const alpha = results.getByRole("row").filter({ hasText: "Alpha Store" });
  const beta = results.getByRole("row").filter({ hasText: "Beta Store" });
  await expect(alpha).toContainText("Alexandra Example");
  await expect(alpha).toContainText("alexandra@example.test");
  await expect(alpha).toContainText("Second Manager");
  await expect(alpha).toContainText("Johannesburg, Gauteng");
  await expect(beta).toContainText("Not assigned");
  await expect(beta.getByRole("img")).toHaveAttribute("src", "/images/franchise/store-default.png");
  for (const image of await results.getByRole("img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    const box = await image.boundingBox();
    expect(box?.width).toBe(52); expect(box?.height).toBe(52);
  }
  const revenue = table.getByLabel("Store revenue period", { exact: true });
  for (const [preset, value] of [["today", 25.1], ["week", 148.55], ["month", 148.55], ["year", 1576774.7]] as const) {
    await revenue.selectOption(preset);
    await expect(alpha).toContainText(money(value));
    await expect(table.getByLabel("Store Performance period", { exact: true })).toHaveValue(preset);
    await expect(alpha.getByRole("link")).toHaveAttribute("href", new RegExp("to=2026-10-13$"));
  }
  await table.getByLabel("Store Performance period", { exact: true }).selectOption("today");
  await expect(revenue).toHaveValue("today");
  await expect(beta).toContainText(money(0));
  await table.getByLabel("Search stores", { exact: true }).fill("second@example.test");
  await expect(results.getByRole("row")).toHaveCount(2);
  await table.getByLabel("Search stores", { exact: true }).fill("no matching store");
  await expect(table.getByText("No stores match your search.")).toBeVisible();
  await table.getByLabel("Search stores", { exact: true }).fill("");
  await table.getByRole("button", { name: "Store", exact: true }).click();
  await table.getByRole("button", { name: "Store", exact: true }).click();
  await expect(results.getByRole("row").nth(1)).toContainText("Beta Store");
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const scroller = table.getByRole("region", { name: "Store performance results" });
    await scroller.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await scroller.evaluate(el => { el.scrollLeft = el.scrollWidth; });
    const link = beta.getByRole("link");
    await expect(link).toBeInViewport();
    expect((await link.boundingBox())?.height).toBe(44);
    if (width === 1440 || width === 390) await table.screenshot({ path: `tmp/store-performance-${width}.png` });
  }
});
