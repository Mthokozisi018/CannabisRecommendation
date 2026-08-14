import { test, expect } from "@playwright/test";

test("effect to saved draft cart flow", async ({ page }) => {
  await page.goto("/dashboard/receptionist");
  await page.getByRole("button", { name: /Relaxed/ }).click();
  await expect(page).toHaveURL(/\/browse/);
  await page.getByRole("link", { name: /Flower/ }).click();
  await page.getByPlaceholder(/Name, brand/).fill("Gelato");
  await page.getByRole("button", { name: "Apply" }).click();
  await page.getByRole("link", { name: /Gelato #33/ }).first().click();
  await expect(page.getByRole("heading", { name: "Gelato #33" })).toBeVisible();
  await page.getByRole("button", { name: /Add to draft/ }).click();
  await page.getByRole("button", { name: /Review and save cart/ }).click();
  await expect(page.getByRole("heading", { name: /Saved draft cart/ })).toBeVisible();
});

test("account entry and privacy center are available", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Account Types/ })).toBeVisible();
  await page.goto("/register");
  await expect(page.getByRole("heading", { name: /Create Customer Account/ })).toBeVisible();
  await page.goto("/account/privacy");
  await expect(page.getByRole("heading", { name: /Privacy Center/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Download my data/ })).toBeVisible();
});
