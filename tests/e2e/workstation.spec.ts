import { test, expect } from "@playwright/test";

test("effect to saved draft cart flow", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Relaxed/ }).click();
  await expect(page).toHaveURL(/\/browse/);
  await page.getByRole("link", { name: /Flower/ }).click();
  await page.getByPlaceholder(/Name, brand/).fill("Gelato");
  await page.getByRole("button", { name: "Apply" }).click();
  await page.getByRole("link", { name: /Gelato #33/ }).first().click();
  await expect(page.getByRole("heading", { name: "Gelato #33" })).toBeVisible();
  await page.getByRole("button", { name: /Add to draft/ }).click();
  await page.getByRole("button", { name: /Save cart/ }).click();
  await page.getByRole("link", { name: /Reopen saved cart/ }).click();
  await expect(page.getByRole("heading", { name: /Saved draft cart/ })).toBeVisible();
});
