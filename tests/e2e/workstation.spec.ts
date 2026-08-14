import { test, expect } from "@playwright/test";

test("receptionist dashboard requires staff sign-in", async ({ page }) => {
  await page.goto("/dashboard/receptionist");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: /Hi there!/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
});

test("legacy account entry routes redirect to staff login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel("Email Address")).toBeVisible();

  await page.goto("/register");
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/account/privacy");
  await expect(page).toHaveURL(/\/login$/);
});
