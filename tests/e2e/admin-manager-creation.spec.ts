import { test, expect as baseExpect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { randomUUID } from "node:crypto";

const expect = baseExpect.configure({ timeout: 30_000 });
test.use({ actionTimeout: 20_000, navigationTimeout: 45_000 });

test("Admin creates credentials and the manager completes their own onboarding", async ({ page, browser }, testInfo) => {
  test.setTimeout(360_000);
  test.skip(
    process.env.GREENCHOICE_ADMIN_MANAGER_E2E !== "true",
    "Explicit staging fixture opt-in required.",
  );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  expect(new URL(url).hostname).toBe("jezbvjepxosphdrykrcg.supabase.co");
  const service = createClient(
    url,
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const publicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const managerClient = createClient(url, publicKey, {
    auth: { persistSession: false },
  });
  const marker = randomUUID();
  const email = `admin-manager-e2e-${marker}@example.com`;
  const temporaryPassword = `Vz!7${randomUUID()}eR`;
  const permanentPassword = `Qr!8${randomUUID()}aD`;
  const storeName = `Manager Verification ${marker}`;
  let authId: string | undefined;
  let storeId: string | undefined;

  const admin = await service
    .from("staff_profiles")
    .select("auth_user_id,email")
    .eq("role", "admin")
    .eq("account_status", "active")
    .single();
  expect(admin.error).toBeNull();
  const beforeStores = await service
    .from("stores")
    .select("id", { count: "exact", head: true });
  expect(beforeStores.error).toBeNull();

  try {
    // Build a staging-only Admin browser session without sending email or
    // changing the administrator's password.
    const link = await service.auth.admin.generateLink({
      type: "magiclink",
      email: admin.data!.email,
    });
    expect(link.error).toBeNull();
    const cookieJar: Array<{ name: string; value: string }> = [];
    const adminSession = createServerClient(url, publicKey, {
      cookies: {
        getAll: () => cookieJar,
        setAll: (items) => {
          for (const item of items) {
            const old = cookieJar.findIndex((cookie) => cookie.name === item.name);
            if (old >= 0) cookieJar.splice(old, 1);
            cookieJar.push({ name: item.name, value: item.value });
          }
        },
      },
    });
    expect((await adminSession.auth.verifyOtp({
      type: "magiclink",
      token_hash: link.data.properties!.hashed_token,
    })).error).toBeNull();
    await page.context().addCookies(cookieJar.map((cookie) => ({
      ...cookie,
      domain: new URL(testInfo.project.use.baseURL ?? "http://127.0.0.1:3001").hostname,
      path: "/",
      sameSite: "Lax" as const,
    })));

    await page.goto("/dashboard/admin/connect-manager");
    const adminForm = page.getByRole("heading", {
      name: "Create Manager Account",
      exact: true,
    }).locator("xpath=ancestor::form");
    await expect(adminForm.locator("input:visible, select:visible, textarea:visible")).toHaveCount(2);
    await expect(adminForm.getByLabel("Manager Email", { exact: true })).toBeVisible();
    await expect(adminForm.getByLabel("Temporary Password", { exact: true })).toBeVisible();
    await expect(adminForm.getByText(/Store Name|Store Physical Address|Full Name/)).toHaveCount(0);

    await adminForm.getByLabel("Manager Email", { exact: true }).fill(email);
    await adminForm.getByLabel("Temporary Password", { exact: true }).fill(temporaryPassword);
    await adminForm.getByRole("button", { name: "Show temporary password" }).click();
    await expect(adminForm.getByLabel("Temporary Password", { exact: true })).toHaveAttribute("type", "text");
    await adminForm.getByRole("button", { name: "Hide temporary password" }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("admin-manager-credentials-mobile.png"), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });

    await adminForm.getByRole("button", { name: "Create Manager Account", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Manager account created" })).toBeVisible();

    const createdProfile = await service
      .from("staff_profiles")
      .select("auth_user_id,role,account_status,is_active,temporary_password_active,account_setup_complete,store_setup_complete,store_id,franchise_id")
      .eq("email", email)
      .single();
    expect(createdProfile.error).toBeNull();
    authId = createdProfile.data!.auth_user_id;
    expect(createdProfile.data).toEqual({
      auth_user_id: authId,
      role: "manager",
      account_status: "active",
      is_active: true,
      temporary_password_active: true,
      account_setup_complete: false,
      store_setup_complete: false,
      store_id: null,
      franchise_id: null,
    });
    const afterCredentials = await service
      .from("stores")
      .select("id", { count: "exact", head: true });
    expect(afterCredentials.count).toBe(beforeStores.count);

    await adminSession.auth.signOut({ scope: "local" });
    await page.context().clearCookies();

    expect((await managerClient.auth.signInWithPassword({
      email,
      password: temporaryPassword,
    })).error).toBeNull();
    expect((await managerClient.from("stores").select("id")).data).toEqual([]);
    expect((await managerClient.from("products").select("id")).data).toEqual([]);

    await page.goto("/login");
    await page.getByLabel("Email Address").fill(email);
    await page.getByPlaceholder("Enter your password").fill(temporaryPassword);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page).toHaveURL(/\/manager\/setup\/account$/);
    for (const route of [
      "/dashboard/manager",
      "/dashboard/manager/inventory",
      "/dashboard/manager/staff",
      "/dashboard/manager/sales",
      "/dashboard/manager/suppliers",
    ]) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/manager\/setup\/account$/);
    }
    const preOnboardingQR = await page.evaluate(async () => {
      const response = await fetch("/api/dashboard/manager/registration-qr");
      return { status: response.status, body: await response.json() };
    });
    expect(preOnboardingQR).toEqual({
      status: 403,
      body: {
        error: "Your staff account cannot access this store's registration QR code.",
        code: "access_denied",
      },
    });

    for (const [label, value] of [
      ["Full Name", "Verification"],
      ["Surname", "Manager"],
      ["Phone Number", "0821234567"],
      ["Physical Address", "123 Verification Road"],
      ["City / Town", "Johannesburg"],
      ["Postal Code", "2000"],
    ]) {
      await page.getByLabel(label, { exact: true }).fill(value);
    }
    await page.getByRole("combobox", { name: "Province" }).selectOption("Gauteng");
    await page.getByLabel(/I agree to the Terms of Service/).check();
    await page.getByLabel(/I agree to the Privacy Policy/).check();
    await expect(page.getByLabel("New Password", { exact: true })).toHaveCount(1);
    await expect(page.getByLabel("Confirm New Password", { exact: true })).toHaveCount(0);
    await page.getByLabel("New Password", { exact: true }).fill(permanentPassword);
    await page.getByRole("button", { name: "Continue to Store Registration" }).click();
    await expect(page).toHaveURL(/\/manager\/setup\/store$/);

    expect((await managerClient.auth.signInWithPassword({
      email,
      password: temporaryPassword,
    })).error).not.toBeNull();
    expect((await managerClient.auth.signInWithPassword({
      email,
      password: permanentPassword,
    })).error).toBeNull();

    for (const route of [
      "/dashboard/manager",
      "/dashboard/manager/inventory/manage",
      "/dashboard/manager/staff",
    ]) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/manager\/setup\/store$/);
    }

    await page.getByLabel("Store Name", { exact: true }).fill(storeName);
    await page.getByLabel("Store Phone Number (Owner)", { exact: true }).fill("0821234567");
    await page.getByLabel("Store Physical Address", { exact: true }).fill("123 Verification Road");
    await page.getByLabel("City / Town", { exact: true }).fill("Johannesburg");
    await page.getByRole("combobox", { name: "Province" }).selectOption("Gauteng");
    await page.getByLabel("Postal Code", { exact: true }).fill("20");
    await page.getByRole("checkbox", { name: /all the information provided is accurate/ }).check();
    await expect(page.getByRole("button", { name: "Complete Store Registration" })).toBeDisabled();
    expect((await service.from("stores").select("id").eq("name", storeName)).data).toEqual([]);

    await page.getByLabel("Postal Code", { exact: true }).fill("2000");
    await page.getByRole("button", { name: "Complete Store Registration" }).click();
    await expect(page).toHaveURL(/\/manager\/setup\/complete$/);

    const completed = await service
      .from("staff_profiles")
      .select("store_id,temporary_password_active,password_changed_at,account_setup_complete,store_setup_complete,onboarding_completed_at")
      .eq("auth_user_id", authId!)
      .single();
    expect(completed.error).toBeNull();
    storeId = completed.data!.store_id;
    expect(storeId).toBeTruthy();
    expect(completed.data!.temporary_password_active).toBe(false);
    expect(completed.data!.password_changed_at).toBeTruthy();
    expect(completed.data!.account_setup_complete).toBe(true);
    expect(completed.data!.store_setup_complete).toBe(true);
    expect(completed.data!.onboarding_completed_at).toBeTruthy();

    // Retrying the existing store-registration RPC updates the same assigned
    // store. It cannot create a duplicate store for this manager.
    const retry = await managerClient.rpc("complete_manager_store_registration", {
      p_store_name: storeName,
      p_store_phone_number: "+27821234567",
      p_physical_store_address: "123 Verification Road",
      p_city: "Johannesburg",
      p_province: "Gauteng",
      p_postal_code: "2000",
      p_slug: `should-not-create-${randomUUID().slice(0, 8)}`,
    });
    expect(retry.error).toBeNull();
    expect((await service.from("stores").select("id").eq("name", storeName)).data).toEqual([{ id: storeId }]);

    await page.getByRole("button", { name: "Go to Manager Dashboard" }).click();
    await expect(page).toHaveURL(/\/billing$/);
    // Unlock only this generated account to exercise non-billing dashboards.
    // This fixture is not evidence of a Paystack payment.
    const billing = await service.from("billing_accounts").update({ status: "active", onboarding_paid_at: new Date().toISOString() })
      .eq("store_id", storeId!).select("id").single();
    expect(billing.error).toBeNull();
    await page.goto("/dashboard/manager");
    await expect(page).toHaveURL(/\/dashboard\/manager$/);
    await page.goto("/dashboard/manager/products/new");
    await expect(page).toHaveURL(/\/dashboard\/manager\/inventory\/manage$/);
    for (const route of [
      "/dashboard/manager/inventory/manage",
      "/dashboard/manager/staff",
    ]) {
      await page.goto(route);
      await expect(page).toHaveURL(new URL(route, testInfo.project.use.baseURL ?? "http://127.0.0.1:3001").href);
      await expect(page.locator("main")).toBeVisible();
    }

    const visible = await managerClient.from("stores").select("id,franchise_id");
    expect(visible.data).toEqual([{ id: storeId, franchise_id: null }]);
    const otherStore = await service
      .from("stores")
      .select("id")
      .neq("id", storeId!)
      .limit(1)
      .single();
    expect(otherStore.error).toBeNull();
    expect((await managerClient.from("staff_profiles").select("id").eq("store_id", otherStore.data!.id)).data).toEqual([]);
    expect((await managerClient.from("products").select("id").eq("store_id", otherStore.data!.id)).data).toEqual([]);

    const context = await browser.newContext();
    const returning = await context.newPage();
    await returning.goto(new URL("/login", testInfo.project.use.baseURL ?? "http://127.0.0.1:3001").href);
    await returning.getByLabel("Email Address").fill(email);
    await returning.getByPlaceholder("Enter your password").fill(permanentPassword);
    await returning.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(returning).toHaveURL(/\/dashboard\/manager$/);
    await context.close();
  } finally {
    const owned = await service
      .from("staff_profiles")
      .select("auth_user_id,store_id")
      .eq("email", email)
      .maybeSingle();
    authId ||= owned.data?.auth_user_id;
    storeId ||= owned.data?.store_id;
    if (authId) {
      await managerClient.auth.signOut();
      if (storeId) {
        const billing = await service.from("billing_accounts").delete().eq("store_id", storeId);
        expect(billing.error).toBeNull();
      }
      await service.from("audit_logs").delete().eq("user_id", authId);
      await service.from("staff_profiles").delete().eq("auth_user_id", authId);
      expect((await service.auth.admin.deleteUser(authId)).error).toBeNull();
    }
    if (storeId) {
      await service.from("audit_logs").delete().eq("store_id", storeId);
      expect((await service.from("stores").delete().eq("id", storeId)).error).toBeNull();
    }
  }
});
