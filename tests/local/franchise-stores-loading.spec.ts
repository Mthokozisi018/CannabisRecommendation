import { expect, test } from "@playwright/test";
const spinnerName = "Loading Franchise Manage Stores";
const advance = async (page: import("@playwright/test").Page, stage: string) => page.evaluate(value => (window as unknown as { fixtureAdvance: (stage: string) => void }).fixtureAdvance(value), stage);

test("Manage Stores spinner starts synchronously on click and stays until store data renders", async ({ page }) => {
  await page.clock.install();
  await page.goto("/dashboard/franchise?stores-navigation-test");
  const link = page.getByRole("link", { name: "Manage Store", exact: true });
  await link.click({ modifiers: ["Control"] });
  await expect(page.getByRole("status")).toHaveCount(0);
  await link.focus(); await link.press("Enter");
  await expect(page.getByRole("status", { name: spinnerName })).toHaveCount(1);
  await page.evaluate(() => window.dispatchEvent(new PopStateEvent("popstate")));
  await expect(page.getByRole("status")).toHaveCount(0);
  expect(await link.evaluate(el => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    return !!document.querySelector('[role="status"][aria-label="Loading Franchise Manage Stores"]');
  })).toBe(true);
  await page.clock.fastForward(10000);
  await expect(page.getByRole("status", { name: spinnerName })).toBeVisible();
  await advance(page, "loading");
  await expect(page).toHaveURL(/\/franchise\/stores$/);
  await expect(page.getByRole("status", { name: spinnerName })).toHaveCount(1);
  await expect(page.getByRole("article")).toHaveCount(0);
  await page.clock.fastForward(30000);
  await expect(page.getByRole("status", { name: spinnerName })).toBeVisible();
  await advance(page, "ready");
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Manage Stores", exact: true })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(7);
});

test("Manage Stores refresh loading uses the same single spinner on desktop tablet and mobile", async ({ page }) => {
  await page.clock.install();
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/dashboard/franchise/stores?stores-refresh-test");
    await expect(page.getByRole("status", { name: spinnerName })).toHaveCount(1);
    await expect(page.getByRole("status").locator('img')).toHaveAttribute("src", "/images/greenchoice-loading.png");
    await expect(page.getByRole("article")).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("status", { name: spinnerName })).toHaveCount(1);
    await advance(page, "ready");
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(page.getByRole("article")).toHaveCount(7);
  }
});

test("Manage Stores failures and stalled loads replace spinner with retry and recover", async ({ page }) => {
  await page.clock.install();
  await page.goto("/dashboard/franchise?stores-navigation-test");
  await page.getByRole("link", { name: "Manage Store", exact: true }).click();
  await page.clock.fastForward(120000);
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByRole("alert")).toContainText("Manage Stores is taking longer than expected");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("status", { name: spinnerName })).toHaveCount(1);
  await advance(page, "error");
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByRole("alert")).toContainText("Manage Stores could not be loaded");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("status", { name: spinnerName })).toHaveCount(1);
  await page.clock.fastForward(120000);
  await expect(page.getByRole("status")).toHaveCount(0);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await advance(page, "ready");
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Manage Stores", exact: true })).toBeVisible();
});


test("a stalled full refresh also stops the spinner and offers retry", async ({ page }) => {
  await page.clock.install();
  await page.goto("/dashboard/franchise/stores?stores-refresh-test");
  await expect(page.getByRole("status", { name: spinnerName })).toHaveCount(1);
  await page.clock.fastForward(120000);
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByRole("alert")).toContainText("taking longer than expected");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await advance(page, "ready");
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByRole("article")).toHaveCount(7);
});
