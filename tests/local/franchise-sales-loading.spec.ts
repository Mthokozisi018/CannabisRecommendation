import { expect, test } from "@playwright/test";

test("sales spinner starts in the click event, survives route preparation and data loading, and clears when ready", async ({ page }) => {
  await page.clock.install();
  await page.goto("/dashboard/franchise?navigation-test=1");
  const sales = page.getByRole("link", { name: "Sales and Performance" });
  await sales.click({ modifiers: ["Control"] });
  await expect(page.getByRole("status")).toHaveCount(0);
  await sales.focus();
  await sales.press("Enter");
  await expect(page.getByRole("status", { name: "Loading Franchise Sales Performance" })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new PopStateEvent("popstate")));
  await expect(page.getByRole("status")).toHaveCount(0);
  const immediate = await sales.evaluate((el) => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    return !!document.querySelector('[role="status"][aria-label="Loading Franchise Sales Performance"]');
  });
  expect(immediate).toBe(true);
  const spinner = page.getByRole("status", { name: "Loading Franchise Sales Performance", exact: true });
  await page.clock.fastForward(10_000);
  await expect(spinner).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard\/franchise\?/);
  await page.evaluate(() => (window as unknown as { fixtureAdvance: (stage: string) => void }).fixtureAdvance("loading"));
  await expect(page).toHaveURL(/\/dashboard\/franchise\/sales$/);
  await expect(spinner).toHaveCount(1);
  await page.clock.fastForward(30_000);
  await expect(spinner).toBeVisible();
  await page.evaluate(() => (window as unknown as { fixtureAdvance: (stage: string) => void }).fixtureAdvance("ready"));
  await expect(spinner).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Franchise Sales Overview", exact: true })).toBeVisible();
});

test("sales errors and stalled navigation stop the spinner and allow retry", async ({ page }) => {
  await page.clock.install();
  await page.goto("/dashboard/franchise?navigation-test=1");
  await page.getByRole("link", { name: "Sales and Performance" }).click();
  await page.clock.fastForward(120_000);
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByRole("alert")).toContainText("taking longer than expected");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("status", { name: "Loading Franchise Sales Performance" })).toBeVisible();
  await page.evaluate(() => (window as unknown as { fixtureAdvance: (stage: string) => void }).fixtureAdvance("error"));
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByRole("alert")).toContainText("Sales Performance could not be loaded");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("status", { name: "Loading Franchise Sales Performance" })).toHaveCount(1);
  await page.clock.fastForward(120_000);
  await expect(page.getByRole("status")).toHaveCount(0);
  await page.getByRole("button", { name: "Try again" }).click();
  await page.evaluate(() => (window as unknown as { fixtureAdvance: (stage: string) => void }).fixtureAdvance("ready"));
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Franchise Sales Overview", exact: true })).toBeVisible();
});

test("other franchise navigation keeps the existing generic spinner", async ({ page }) => {
  await page.clock.install();
  await page.goto("/dashboard/franchise?navigation-test=1");
  await page.getByRole("link", { name: "Add Store" }).click();
  await expect(page.getByRole("status", { name: "Loading", exact: true })).toBeVisible();
  await page.clock.fastForward(9000);
  await expect(page.getByRole("status")).toHaveCount(0);
});
