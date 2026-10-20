import { test, expect } from "@playwright/test";

test("store cards align all sections and buttons at each responsive breakpoint", async ({ page }) => {
  await page.goto("/dashboard/franchise/stores");
  const cards = page.getByRole("article");
  await expect(cards).toHaveCount(7);
  for (const [width, columns] of [[1600, 4], [1440, 4], [1439, 3], [1024, 3], [1023, 2], [768, 2], [767, 1], [390, 1], [320, 1]]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect.poll(async () => cards.first().evaluate(el => getComputedStyle(el.parentElement!).gridTemplateColumns.split(" ").length)).toBe(columns);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const boxes = await cards.evaluateAll(els => els.map(el => {
      const rect = (node: Element) => { const b=node.getBoundingClientRect(); return {x:b.x,y:b.y,width:b.width,height:b.height,bottom:b.bottom}; };
      const heading=el.querySelector("h2")!;
      const rows=[...el.querySelectorAll("p")];
      return {card:rect(el), image:rect(el.querySelector("img")!), heading:rect(heading), badge:rect(heading.nextElementSibling!), rows:rows.map(row=>({row:rect(row),icon:rect(row.querySelector("svg")!),text:rect(row.querySelector("span")!)})),button:rect(el.querySelector("a")!)};
    }));
    for (let i=0;i<boxes.length;i++) {
      const box=boxes[i];
      expect(Math.abs(box.heading.y-box.badge.y)).toBeLessThan(1);
      expect(box.button.height).toBe(36);
      expect(box.card.bottom-box.button.bottom).toBeLessThanOrEqual(24);
      expect(box.image.width/box.image.height).toBeCloseTo(16/9, 1);
      for (const row of box.rows) {
        expect(Math.abs(row.icon.y-row.text.y)).toBeLessThan(4);
        expect(row.text.x).toBeGreaterThan(row.icon.x+row.icon.width);
      }
      const first=boxes[i-i%columns];
      expect(box.card.bottom-box.button.bottom).toBeCloseTo(first.card.bottom-first.button.bottom, 0);
      expect(box.card.height).toBeCloseTo(first.card.height, 0);
      expect(box.button.y).toBeCloseTo(first.button.y, 0);
      expect(box.button.width).toBeCloseTo(first.button.width, 0);
      expect(box.image.height).toBeCloseTo(first.image.height, 0);
      for (let j=0;j<3;j++) expect(box.rows[j].row.y).toBeCloseTo(first.rows[j].row.y, 0);
    }
    if (width===1440 || width===390) await page.screenshot({path:`tmp/store-directory-${width}.png`,fullPage:true});
  }
});

test("directory retains complete addresses, status, search, fallbacks and management links", async ({ page }) => {
  await page.goto("/dashboard/franchise/stores");
  const cards=page.getByRole("article");
  const search=page.getByRole("searchbox",{name:"Search stores by name, manager or location"});
  await expect(cards.first()).toContainText("Johannesburg, Gauteng, 2196");
  await expect(cards.nth(1)).toContainText("Inactive");
  await expect(cards.nth(2)).toContainText("No managers assigned");
  await expect(cards.nth(2)).toContainText("No phone recorded");
  await search.fill("Alexandra");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Botanical Gardens and Wellness Centre");
  await search.fill("Rosebank");
  await expect(cards).toHaveCount(1);
  await search.fill("Botanical Gardens Boulevard");
  await expect(cards).toHaveCount(1);
  await cards.getByRole("link",{name:/Manage Store/}).click();
  await expect(page).toHaveURL(/\/dashboard\/franchise\/stores\/directory-0\?q=Botanical\+Gardens\+Boulevard$/);
  await page.getByRole("link",{name:"Back to Manage Stores"}).click();
  await expect(page).toHaveURL(/\/dashboard\/franchise\/stores\?q=Botanical\+Gardens\+Boulevard$/);
  await expect(search).toHaveValue("Botanical Gardens Boulevard");
  await expect(cards).toHaveCount(1);
  await page.goto("/dashboard/franchise/stores");
  await search.fill("no-such-store");
  await expect(page.getByText("No stores match your search.")).toBeVisible();
  await expect(page.getByRole("link",{name:"Add Store",exact:true})).toHaveAttribute("href","/dashboard/franchise/stores/new");
  await search.clear();
  await expect(cards).toHaveCount(7);
});

test("every branch returns to its directory and keeps the directory search", async ({page}) => {
  for (const [query,id] of [["Rosebank","directory-1"],["Store 3","directory-2"],["","directory-6"]]) {
    await page.goto("/dashboard/franchise/stores");
    const search=page.getByRole("searchbox",{name:"Search stores by name, manager or location"});
    await search.fill(query);
    const manage=page.locator(`a[href^="/dashboard/franchise/stores/${id}"]`);
    await manage.click();
    await expect(page.getByRole("tablist",{name:"Store management"})).toBeVisible();
    const back=page.getByRole("link",{name:"Back to Manage Stores"});
    const suffix=query ? `?${new URLSearchParams({q:query})}` : "";
    await expect(back).toHaveAttribute("href",`/dashboard/franchise/stores${suffix}`);
    await back.click();
    await expect(search).toHaveValue(query);
    await expect(page.getByRole("article")).toHaveCount(query ? 1 : 7);
  }
});

test("direct branch visits have a directory fallback and other Back buttons retain their destinations", async ({page}) => {
  for (const path of ["/dashboard/franchise/stores/directory-0", "/dashboard/franchise/stores/directory-1?q=Rosebank"]) {
    await page.goto(path);
    await expect(page.getByRole("link",{name:"Back to Manage Stores"})).toHaveAttribute("href",path.includes("?") ? "/dashboard/franchise/stores?q=Rosebank" : "/dashboard/franchise/stores");
  }
  for (const path of ["/dashboard/franchise/stores", "/dashboard/franchise/stores/new", "/dashboard/franchise/sales"]) {
    await page.goto(path);
    await expect(page.getByRole("link",{name:"Back to Dashboard"})).toHaveAttribute("href","/dashboard/franchise");
  }
  await page.goto("/dashboard/franchise/sales/a?from=2026-10-01&to=2026-10-13");
  await expect(page.getByRole("link",{name:"Back to Sales Overview"})).toHaveAttribute("href","/dashboard/franchise/sales?from=2026-10-01&to=2026-10-13");
});
