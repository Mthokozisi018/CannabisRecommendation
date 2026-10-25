import { test, expect } from "@playwright/test";
test("store KPI order, independent charts and tables, indicators and responsive layout", async ({
  page,
}) => {
  await page.goto("/dashboard/franchise/sales/a");
  await expect(page.getByRole("link", { name: "Back to Sales Overview" })).toHaveAttribute("href", "/dashboard/franchise/sales");
  const cards = page.locator('[class*="kpisCompact"]');
  await expect(cards.locator("p")).toHaveText([
    "Revenue This Week",
    "Revenue This Month",
    "Revenue This Year",
    "Total Customers",
  ]);
  const kpis = await cards.innerText();
  const revenue = page.getByRole("region", {
    name: "Store Revenue",
    exact: true,
  });
  const category = page.getByRole("region", {
    name: "Sales by Category",
    exact: true,
  });
  const products = page.getByRole("region", {
    name: "Product / Sales Performance",
    exact: true,
  });
  const transactions = page.getByRole("region", {
    name: "Recent Transactions",
    exact: true,
  });
  await expect(page.locator('input[type="date"]')).toHaveCount(0);
  await revenue.getByLabel("Store Revenue period", { exact: true }).selectOption("days");
  await expect(revenue.locator('circle[r="5"]')).toHaveCount(13);
  await expect(revenue.getByRole("button", { name: /Day 13:.*R/ })).toHaveAttribute("aria-label", `Day 13: 13 Oct 2026 (in progress): ${new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(25.1)}`);
  await expect(revenue.getByText("Daily Revenue \u2014 October 2026",{exact:true})).toBeVisible();
  await expect(
    category.getByText("Showing: This Month — October 2026"),
  ).toBeVisible();
  await category.getByRole("combobox").selectOption("week");
  await expect(
    category.getByText(
      "Showing: This Week — 12 October 2026 – 13 October 2026",
    ),
  ).toBeVisible();
  await expect(
    revenue.getByText("Daily Revenue \u2014 October 2026", {exact:true}),
  ).toBeVisible();
  await category.getByRole("combobox").selectOption("today");
  await expect(
    category.getByText(
      new Intl.NumberFormat("en-ZA", {
        style: "currency",
        currency: "ZAR",
      }).format(25.1),
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    products.getByText("Showing: This Month — October 2026"),
  ).toBeVisible();
  await transactions.getByRole("combobox").selectOption("today");
  await expect(
    transactions.getByText(/Transactions in Period: 2/),
  ).toBeVisible();
  await expect(
    products.getByText("Showing: This Month — October 2026"),
  ).toBeVisible();
  await category.getByRole("combobox").selectOption("custom");
  await category
    .getByLabel("Sales by Category from", { exact: true })
    .fill("2025-06-01");
  await category
    .getByLabel("Sales by Category to", { exact: true })
    .fill("2025-06-30");
  await category.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(
    category.getByText(
      "Showing: Custom Date Range — 1 June 2025 – 30 June 2025",
    ),
  ).toBeVisible();
  await expect(cards).toHaveText(kpis, { useInnerText: true });
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});


const money = (value: number) => new Intl.NumberFormat("en-ZA", {style:"currency",currency:"ZAR"}).format(value);
test("first-sale history, store isolation and shared expanded graphs use actual calendar labels", async ({page}) => {
  await page.goto("/dashboard/franchise/sales?first-sale=1");
  const franchise=page.getByRole("region",{name:"Franchise Revenue",exact:true});
  const store=page.getByRole("region",{name:"Store Revenue",exact:true});
  const labels=(scope:import("@playwright/test").Locator)=>scope.locator('section').first().locator('[class*="pointValue"]');
  await expect(labels(franchise)).toHaveText([20,0,0,0,155].map(money));
  await expect(labels(store)).toHaveText([money(150)]);
  await franchise.getByLabel("Franchise Revenue period",{exact:true}).selectOption("days");
  await expect(franchise.locator('[class*="dateTick"] text').first()).toHaveText("Day 1");
  await expect(labels(franchise)).toHaveCount(13);
  await expect(labels(franchise).first()).toHaveText(money(0));
  await expect(labels(franchise).nth(1)).toHaveText(money(0));
  await store.getByLabel("Store Revenue period",{exact:true}).selectOption("days");
  await expect(store.locator('[class*="dateTick"] text')).toHaveText(["Day 12","Day 13"]);
  await expect(labels(store)).toHaveText([100,50].map(money));
  for(const [scope,name,expectedWeek,total] of [[franchise,"Franchise Revenue","Week 25",175],[store,"Store Revenue","Week 42",150]] as const) {
    await scope.getByLabel(`${name} period`,{exact:true}).selectOption("weeks");
    await expect(scope.locator('[class*="dateTick"] text').first()).toHaveText(expectedWeek);
    await scope.getByLabel(`${name} period`,{exact:true}).selectOption("years");
    await expect(labels(scope)).toHaveText([money(total)]);
    await scope.getByLabel(`${name} period`,{exact:true}).selectOption("days");
    const before=await labels(scope).allTextContents();
    await scope.getByRole("button",{name:`Expand ${name.toLowerCase()} graph`}).click();
    const modal=page.getByRole("dialog",{name,exact:true});
    await expect(modal.getByRole("combobox")).toHaveCount(1);
    await expect(modal.locator('[class*="pointValue"]')).toHaveText(before);
    await expect(modal.locator('[class*="dateTick"] text').first()).toHaveText(name==="Store Revenue"?"12":"1");
    await modal.locator('circle[role="button"]').last().hover();
    await expect(modal.getByRole("tooltip")).toContainText("R");
    await page.setViewportSize({width:390,height:850});
    expect(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
    await modal.getByRole("combobox").focus();
    await page.mouse.move(0,0);
    if (name === "Franchise Revenue") {
      await modal.locator('[class*="chartScroll"]').evaluate(el => { el.scrollLeft = 0; });
      await expect(modal.locator('[class*="pointValue"]').first()).toBeInViewport();
    }
    await modal.screenshot({path:`tmp/first-sale-${name.replaceAll(" ","-")}.png`});
    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible();
  }
});

test("no-sale graphs become active and follow a new year without losing historical store totals", async ({page})=>{
  await page.clock.install();
  await page.goto("/dashboard/franchise/sales?first-sale=1&no-sales=1");
  const store=page.getByRole("region",{name:"Store Revenue",exact:true});
  await expect(store.getByText(/No sales recorded yet/)).toBeVisible();
  await expect(store.locator('circle')).toHaveCount(0);
  await store.getByRole("button",{name:"Expand store revenue graph"}).click();
  const modal=page.getByRole("dialog",{name:"Store Revenue",exact:true});
  await expect(modal.getByText(/No sales recorded yet/)).toBeVisible();
  await modal.getByRole("button",{name:"Close expanded revenue graph"}).click();
  await page.clock.fastForward(60000);
  expect(await page.evaluate(()=>(window as unknown as {fixtureRefreshCount:number}).fixtureRefreshCount)).toBeGreaterThan(0);
  await page.evaluate(()=>(window as unknown as {fixtureRevenueStartSales:()=>void}).fixtureRevenueStartSales());
  await expect(store.locator('[class*="pointValue"]')).toHaveText([money(150)]);
  await store.getByLabel("Store Revenue period",{exact:true}).selectOption("years");
  await page.evaluate(()=>(window as unknown as {fixtureRevenueDate:(date:string)=>void}).fixtureRevenueDate("2027-01-05T12:00:00+02:00"));
  await expect(store.getByText("Monthly Revenue \u2014 2027",{exact:true})).toBeVisible();
  await expect(store.locator('[class*="pointValue"]')).toHaveText([money(7)]);
  await store.getByLabel("Store Revenue period",{exact:true}).selectOption("years");
  await expect(store.locator('[class*="pointValue"]')).toHaveText([150,7].map(money));
});
