import { expect, test, type Browser, type Page } from "@playwright/test";

const managerEmail = process.env.E2E_ONBOARDING_MANAGER_EMAIL ?? "";
const temporaryPassword = process.env.E2E_ONBOARDING_TEMP_PASSWORD ?? "";
const permanentPassword = process.env.E2E_ONBOARDING_NEW_PASSWORD ?? "";

async function logIn(page: Page, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email Address").fill(managerEmail);
  await page.getByLabel("Password", { exact: true }).fill(password);
  const loginResponse = page.waitForResponse((response) => response.url().endsWith("/api/auth/login"), { timeout: 30_000 });
  await page.getByRole("button", { name: "Sign In" }).click();
  return loginResponse;
}

async function verifyEmptyAccountForm(browser: Browser, viewport: { width: number; height: number }, screenshotName: string) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  expect((await logIn(page, temporaryPassword)).status()).toBe(200);
  await expect(page).toHaveURL(/\/manager\/setup\/account$/, { timeout: 30_000 });

  for (const label of ["Full Name", "Surname", "Phone Number", "Physical Address", "City / Town", "Postal Code"]) {
    await expect(page.getByLabel(label, { exact: true })).toHaveValue("");
  }
  await expect(page.getByRole("combobox", { name: "Province" })).toHaveValue("");
  await expect(page.getByLabel("New Password", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Confirm New Password", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Current Temporary Password", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Your information is safe")).toHaveCount(0);
  await expect(page.getByText("Replace temporary password")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/${screenshotName}`, fullPage: true });
  await context.close();
}

test("manual manager account registration is empty, compact, and completes securely", async ({ browser }) => {
  test.setTimeout(120_000);
  test.skip(!managerEmail || !temporaryPassword || !permanentPassword, "Synthetic onboarding credentials are not configured.");

  await verifyEmptyAccountForm(browser, { width: 390, height: 844 }, "manager-onboarding-mobile.png");
  await verifyEmptyAccountForm(browser, { width: 1440, height: 900 }, "manager-onboarding-desktop.png");

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  expect((await logIn(page, temporaryPassword)).status()).toBe(200);

  await page.getByLabel("Full Name", { exact: true }).fill("Codex Test");
  await page.getByLabel("Surname", { exact: true }).fill("Manager");
  await page.getByLabel("Phone Number", { exact: true }).fill("071 234 5678");
  await page.getByLabel("Physical Address", { exact: true }).fill("10 Test Avenue");
  await page.getByLabel("City / Town", { exact: true }).fill("Johannesburg");
  await page.getByRole("combobox", { name: "Province" }).selectOption("Gauteng");
  await page.getByLabel("Postal Code", { exact: true }).fill("2001");
  await page.getByLabel("New Password", { exact: true }).fill(permanentPassword);
  await page.getByLabel("Confirm New Password", { exact: true }).fill(permanentPassword);

  await page.getByRole("button", { name: "Continue to Store Registration" }).click();
  await expect(page).toHaveURL(/\/manager\/setup\/account$/);
  await expect(page.getByLabel(/I agree to the Terms of Service/)).not.toBeChecked();
  await expect(page.getByLabel(/I agree to the Privacy Policy/)).not.toBeChecked();

  await page.getByLabel(/I agree to the Terms of Service/).check();
  await page.getByLabel(/I agree to the Privacy Policy/).check();
  await page.getByLabel("Confirm New Password", { exact: true }).fill(`${permanentPassword}x`);
  await page.getByRole("button", { name: "Continue to Store Registration" }).click();
  await expect(page.locator('p[role="alert"]')).toHaveText("Password and confirm password must match");
  await expect(page.getByLabel("Full Name", { exact: true })).toHaveValue("Codex Test");
  await expect(page.getByLabel(/I agree to the Terms of Service/)).toBeChecked();

  await page.getByLabel("New Password", { exact: true }).fill("abcdefghijkl");
  await page.getByLabel("Confirm New Password", { exact: true }).fill("abcdefghijkl");
  await page.getByRole("button", { name: "Continue to Store Registration" }).click();
  await expect(page.locator('p[role="alert"]')).toHaveText("At least 1 uppercase letter");
  await expect(page.getByLabel("Full Name", { exact: true })).toHaveValue("Codex Test");
  await expect(page.getByLabel(/I agree to the Privacy Policy/)).toBeChecked();

  await page.getByLabel("New Password", { exact: true }).fill(permanentPassword);
  await page.getByLabel("Confirm New Password", { exact: true }).fill(permanentPassword);
  const continueButton = page.getByRole("button", { name: "Continue to Store Registration" });
  await expect(continueButton).toBeEnabled();
  await continueButton.click();
  await expect(page).toHaveURL(/\/manager\/setup\/store$/, { timeout: 30_000 });
  await context.close();

  const oldPasswordContext = await browser.newContext();
  const oldPasswordPage = await oldPasswordContext.newPage();
  expect((await logIn(oldPasswordPage, temporaryPassword)).status()).toBe(401);
  await expect(oldPasswordPage).toHaveURL(/\/login$/);
  await expect(oldPasswordPage.getByText("Invalid email or password.", { exact: true })).toBeVisible();
  await oldPasswordContext.close();

  const permanentPasswordContext = await browser.newContext();
  const permanentPasswordPage = await permanentPasswordContext.newPage();
  expect((await logIn(permanentPasswordPage, permanentPassword)).status()).toBe(200);
  await expect(permanentPasswordPage).toHaveURL(/\/manager\/setup\/store$/, { timeout: 30_000 });
  await permanentPasswordContext.close();
});
