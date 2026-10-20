import { test, expect } from "@playwright/test";

const money = (value: number) => new Intl.NumberFormat("en-ZA", {style:"currency",currency:"ZAR"}).format(value);

for (const [path, lineTitle, barTitle] of [
  ["sales", "Franchise Revenue", "Sales by Store"],
  ["sales/a", "Store Revenue", "Sales by Category"],
]) {
  test(`${barTitle} expands independently, filters actual revenue and restores focus`, async ({page}) => {
    test.setTimeout(60000);
    await page.goto(`/dashboard/franchise/${path}`);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const line = page.getByRole("region", {name:lineTitle, exact:true});
    const bars = page.getByRole("region", {name:barTitle, exact:true});
    const kpis = await page.locator('[class*="kpisCompact"]').innerText();
    await expect(line.getByRole("combobox")).toHaveCount(1);
    await expect(line.getByRole("combobox").locator("option")).toHaveText(["Days","Weeks","Months","Years"]);
    await expect(line.getByLabel("Reporting year", {exact:true})).toHaveCount(0);
    await expect(line.getByLabel("Reporting month", {exact:true})).toHaveCount(0);
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({width,height:900});
      const inlineValues = await bars.locator('[class*="pointValue"]').allTextContents();
      const expand = bars.getByRole("button",{name:`Expand ${barTitle.toLowerCase()} graph`,exact:true});
      await expand.click();
      const modal = page.getByRole("dialog",{name:barTitle,exact:true});
      await expect(modal).toBeVisible();
      await expect(page.locator("dialog[open]")).toHaveCount(1);
      await expect(modal.getByRole("heading",{name:barTitle,exact:true})).toBeVisible();
      await expect(modal.locator('circle[role="button"]')).toHaveCount(0);
      await expect(modal.locator('rect[fill^="url"]')).not.toHaveCount(0);
      await expect.poll(() => modal.locator('[class*="barPlot"] > svg').evaluate(el => Math.abs((el as SVGSVGElement).viewBox.baseVal.width-el.getBoundingClientRect().width))).toBeLessThan(1);
      const allValues: string[] = [];
      const previous = modal.getByRole("button",{name:`Previous ${barTitle} bars`,exact:true});
      if (await previous.count()) while(await previous.isEnabled()) await previous.click();
      do {
        allValues.push(...await modal.locator('[class*="pointValue"]').allTextContents());
        const next=modal.getByRole("button",{name:`Next ${barTitle} bars`,exact:true});
        if (!await next.count() || await next.isDisabled()) break;
        await next.click();
      } while(true);
      expect(allValues).toEqual(expect.arrayContaining(inlineValues));
      if (await previous.count()) while(await previous.isEnabled()) await previous.click();
      expect((await modal.locator('[class*="chartFrame"]').boundingBox())!.height).toBeGreaterThan(400);
      const heading = await modal.getByRole("heading").boundingBox();
      const box = await modal.boundingBox();
      expect(Math.abs(heading!.x+heading!.width/2-box!.x-box!.width/2)).toBeLessThan(1);
      expect(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
      await modal.getByLabel(`${barTitle} period`,{exact:true}).selectOption("today");
      await expect(modal.locator('[class*="pointValue"]').first()).toHaveText(money(25.1));
      await expect(modal.locator('rect[fill^="url"] title')).toHaveCount(0);
      await expect(modal.locator('g[aria-label]').first()).toHaveAttribute("aria-label",new RegExp("25,10"));
      await expect(modal.locator('g[aria-label] title').first()).toContainText(money(25.1));
      await modal.getByLabel(`${barTitle} period`,{exact:true}).selectOption("custom");
      await modal.getByLabel(`${barTitle} from`,{exact:true}).fill("2025-06-01");
      await modal.getByLabel(`${barTitle} to`,{exact:true}).fill("2025-06-30");
      await modal.getByRole("button",{name:"Apply",exact:true}).click();
      await expect(modal.getByText(/Showing: Custom Date Range/)).toBeVisible();
      if (path.endsWith("/a")) await expect(modal.locator('[class*="pointValue"]')).toHaveText([money(10)]);
      await modal.getByLabel(`${barTitle} period`,{exact:true}).selectOption("month");
      await expect(modal.getByText(/Showing: This Month/)).toBeVisible();
      if (width === 1440 || width === 390) await modal.screenshot({path:`tmp/${path.endsWith('/a')?'category':'stores'}-expanded-${width}.png`});
      await page.keyboard.press("Escape");
      await expect(modal).not.toBeVisible();
      await expect(expand).toBeFocused();
      await expand.click();
      await modal.getByRole("button",{name:`Close expanded ${barTitle.toLowerCase()} graph`,exact:true}).click();
      await expect(modal).not.toBeVisible();
      await expect(expand).toBeFocused();
      await line.getByRole("button",{name:`Expand ${lineTitle.toLowerCase()} graph`,exact:true}).click();
      const lineModal = page.getByRole("dialog",{name:lineTitle,exact:true});
      await expect(lineModal).toBeVisible();
      await expect(lineModal.locator('circle[role="button"]')).not.toHaveCount(0);
      await expect(lineModal.locator('rect[fill^="url"]')).toHaveCount(0);
      await lineModal.getByRole("button",{name:"Close expanded revenue graph",exact:true}).click();
    }
    await expect(page.locator('[class*="kpisCompact"]')).toHaveText(kpis,{useInnerText:true});
    expect(errors).toEqual([]);
  });
}

test("an old same-day revenue preference keeps its grouping and uses the current period", async ({page}) => {
  await page.addInitScript(() => sessionStorage.setItem("greenchoice.sales.v3.reporting.franchise",JSON.stringify({calendarDay:"2026-10-13",selection:{view:"days",year:2024,month:2}})));
  await page.goto("/dashboard/franchise/sales");
  const line = page.getByRole("region",{name:"Franchise Revenue",exact:true});
  await expect(line.getByText("Daily Revenue — October 2026",{exact:true})).toBeVisible();
  await expect(line.locator('circle[r="5"]')).toHaveCount(13);
  await line.getByRole("combobox").selectOption("years");
  await expect(line.locator('[class*="pointValue"]')).toHaveText([0,30,1576775].map(money));
});

test("expanded store bars paginate every store with readable amounts and names", async ({page}) => {
  await page.goto("/dashboard/franchise/sales?many-stores=1");
  await page.getByRole("button",{name:"Expand sales by store graph",exact:true}).click();
  const modal = page.getByRole("dialog",{name:"Sales by Store",exact:true});
  for (const width of [1440,390]) {
    await page.setViewportSize({width,height:900});
    await expect.poll(() => modal.locator('[class*="barPlot"] > svg').evaluate(el => {
      const svg = el as SVGSVGElement;
      return Math.abs(svg.viewBox.baseVal.width - svg.getBoundingClientRect().width);
    })).toBeLessThan(1);
    const previous = modal.getByRole("button",{name:"Previous Sales by Store bars",exact:true});
    const next = modal.getByRole("button",{name:"Next Sales by Store bars",exact:true});
    while (await previous.isEnabled()) await previous.click();
    const names = new Set<string>();
    do {
      for (const label of await modal.locator('[class*="barNames"] span').allTextContents()) names.add(label);
      const boxes = await modal.locator('[class*="pointValue"]').evaluateAll(els=>els.map(el=>{
        const box = (el as SVGGraphicsElement).getBBox();
        return {left:box.x,right:box.x+box.width};
      }));
      for (let i=1;i<boxes.length;i++) expect(boxes[i].left).toBeGreaterThan(boxes[i-1].right);
      if (await next.isDisabled()) break;
      await next.click();
    } while (true);
    expect(names.size).toBe(24);
    expect(names.has("GreenChoice Johannesburg Branch 01")).toBe(true);
    expect(names.has("GreenChoice Johannesburg Branch 24")).toBe(true);
  }
});
