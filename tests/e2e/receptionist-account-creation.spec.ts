import { expect, test, type Browser } from "@playwright/test";

const managerEmail = process.env.E2E_MANAGER_EMAIL ?? "";
const managerPassword = process.env.E2E_STAFF_PASSWORD ?? "";

async function verifyCreateAccountPage(browser: Browser, viewport: { width: number; height: number }, screenshotName: string) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email Address").fill(managerEmail);
  await page.getByLabel("Password", { exact: true }).fill(managerPassword);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/dashboard\/manager$/, { timeout: 30_000 });

  await page.goto("/dashboard/manager/staff/new");
  await expect(page.getByRole("heading", { name: /Create a New Staff Account/ })).toBeVisible();
  await expect(page.getByLabel("Email Address", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Temporary Password", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Confirm Temporary Password", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create Account" })).toBeVisible();
  await expect(page.getByText("Enter Account Details", { exact: true })).toBeVisible();
  await expect(page.getByText("Account Created", { exact: true })).toBeVisible();
  await expect(page.getByText("Receptionist Setup", { exact: true })).toBeVisible();
  await expect(page.getByText("Account Active", { exact: true })).toBeVisible();
  await expect(page.getByText(/receive an email/i)).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/${screenshotName}`, fullPage: true });
  await context.close();
}

test("manager receptionist account form is visible and responsive without creating data", async ({ browser }) => {
  test.skip(!managerEmail || !managerPassword, "Local manager E2E credentials are not configured.");
  await verifyCreateAccountPage(browser, { width: 390, height: 844 }, "receptionist-create-mobile.png");
  await verifyCreateAccountPage(browser, { width: 1440, height: 900 }, "receptionist-create-desktop.png");
});

test("retired receptionist invitation route is unavailable", async ({ request }) => {
  const response = await request.get("/staff/invitation/onboarding?invitation_id=00000000-0000-4000-8000-000000000001");
  expect(response.status()).toBe(404);
});
