import { expect, test } from "@playwright/test";

const managerEmail = process.env.E2E_MANAGER_EMAIL ?? "";
const password = process.env.E2E_STAFF_PASSWORD ?? "";

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email Address").fill(managerEmail);
  await page.getByPlaceholder("Enter your password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
}

test("manager can use the grouped Sales Overview without page overflow", async ({ page }) => {
  test.skip(!managerEmail || !password, "Local E2E manager credentials are not configured.");
  await signIn(page);
  await page.goto("/dashboard/manager/sales");
  await expect(page.getByRole("heading", { name: "Sales Overview" })).toBeVisible();
  await expect(page.getByLabel("Report month")).toBeVisible();
  await expect(page.getByLabel("Report week")).toBeVisible();
  await expect(page.getByLabel("Search transactions")).toBeVisible();
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
  const firstTransaction = page.locator('article button[aria-expanded]').first();
  if (await firstTransaction.count()) {
    await firstTransaction.focus();
    await page.keyboard.press("Enter");
    await expect(firstTransaction).toHaveAttribute("aria-expanded", "true");
  }
});
