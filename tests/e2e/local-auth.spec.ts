import { expect, test } from "@playwright/test";

const localPassword = process.env.E2E_STAFF_PASSWORD ?? "";
const managerEmail = process.env.E2E_MANAGER_EMAIL ?? "";
const receptionistEmail = process.env.E2E_RECEPTIONIST_EMAIL ?? "";

async function logIn(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email Address").fill(email);
  await page.getByPlaceholder("Enter your password").fill(localPassword);
  await page.getByRole("button", { name: "Sign In" }).click();
}

test("local manager and receptionist reach their role dashboards", async ({ browser }) => {
  test.skip(!localPassword || !managerEmail || !receptionistEmail, "Local E2E staff credentials are not configured.");
  const managerContext = await browser.newContext();
  const managerPage = await managerContext.newPage();
  await logIn(managerPage, managerEmail);
  await expect(managerPage).toHaveURL(/\/dashboard\/manager$/);
  await managerContext.close();

  const receptionistContext = await browser.newContext();
  const receptionistPage = await receptionistContext.newPage();
  await logIn(receptionistPage, receptionistEmail);
  await expect(receptionistPage).toHaveURL(/\/dashboard\/receptionist$/);
  await receptionistContext.close();
});

test("a wrong password remains rejected", async ({ page }) => {
  test.skip(!managerEmail, "Local E2E manager email is not configured.");
  await page.goto("/login");
  await page.getByLabel("Email Address").fill(managerEmail);
  await page.getByPlaceholder("Enter your password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(page).toHaveURL(/\/login\?error=invalid$/);
  await expect(page.getByText("Invalid GreenChoice staff email or password.")).toBeVisible();
});
