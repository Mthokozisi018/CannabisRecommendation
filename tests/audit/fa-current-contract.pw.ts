import { test, expect as baseExpect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const expect = baseExpect.configure({ timeout: 30_000 });

test.use({ actionTimeout: 20_000, navigationTimeout: 45_000 });

// Explicitly opt in: this test creates and removes only its own staging data.
test("AUD-E2E current transaction-table contract and direct routes", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(480_000);
  test.skip(
    process.env.GREENCHOICE_FA_E2E !== "true",
    "Set GREENCHOICE_FA_E2E=true to run isolated staging fixtures.",
  );
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey =
      process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
  expect(new URL(url).hostname.split(".")[0]).toBe(
    process.env.EXPECTED_SUPABASE_PROJECT_REF,
  );
  expect(process.env.EXPECTED_SUPABASE_PROJECT_REF).not.toBe(
    process.env.PRODUCTION_SUPABASE_PROJECT_REF,
  );
  const service = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
  const publicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const capability = await service.rpc("franchise_mutation_v2", {
    p_actor: "00000000-0000-4000-8000-000000000000", p_action: "create_store", p_data: {},
  });
  test.skip(capability.error?.code === "PGRST202", "BLOCKED: local FA remediation migration is not applied to this isolated hosted environment.");
  expect(capability.error?.code).toBe("42501"); // An unknown actor must fail before any write.
  const marker = randomUUID().slice(0, 8),
    password = `Qz!7${randomUUID()}aB`,
    permanent = `Yk!9${randomUUID()}cD`;
  const users: string[] = [],
    franchises: string[] = [],
    stores: string[] = [];
  const email = `fa-${marker}@example.com`;
  const admin = await service
    .from("staff_profiles")
    .select("auth_user_id")
    .eq("role", "admin")
    .eq("account_status", "active")
    .limit(1)
    .single();
  expect(admin.error).toBeNull();
  const actor = admin.data!.auth_user_id;
  const rpc = async (
    actorId: string,
    action: string,
    data: Record<string, unknown>,
  ) => {
    const result = await service.rpc("franchise_mutation", {
      p_actor: actorId,
      p_action: action,
      p_data: data,
    });
    if (result.error) throw new Error(`${action}: ${result.error.message}`);
    return String(result.data);
  };
  const createAuth = async (
    email: string,
    role: string,
    metadata: Record<string, string>,
  ) => {
    const result = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { greenchoice_role: role, ...metadata },
    });
    if (result.error) throw result.error;
    users.push(result.data.user!.id);
    return result.data.user!.id;
  };
  try {
    for (const suffix of ["A", "B"]) {
      franchises.push(
        await rpc(actor, "create_franchise", {
          name: `FA verification ${marker} ${suffix}`,
          email: `franchise-${marker}@example.com`,
          phone: "+27821234567",
          address: "Verification address",
          registrationNumber: "",
        }),
      );
    }
    const fa = await createAuth(email, "franchise_admin", {
      greenchoice_created_by: actor,
      greenchoice_franchise_id: franchises[0],
    });
    await rpc(actor, "create_fa", {
      franchiseId: franchises[0],
      authUserId: fa,
      firstName: "Verification",
      surname: "Administrator",
      phone: "+27821234567",
    });
    const faOther = await createAuth(
      `fa-other-${marker}@example.com`,
      "franchise_admin",
      {
        greenchoice_created_by: actor,
        greenchoice_franchise_id: franchises[1],
      },
    );
    await rpc(actor, "create_fa", {
      franchiseId: franchises[1],
      authUserId: faOther,
      firstName: "Other",
      surname: "Administrator",
      phone: "+27821234567",
    });
    // Other fixture is initialized through the same password-before-completion contract.
    const otherClient = createClient(url, publicKey, {
      auth: { persistSession: false },
    });
    await otherClient.auth.signInWithPassword({
      email: `fa-other-${marker}@example.com`,
      password,
    });
    await otherClient.auth.updateUser({ password: permanent });
    await rpc(faOther, "complete_setup", {
      termsVersion: "v1.0",
      privacyVersion: "v1.0",
    });
    stores.push(
      await rpc(faOther, "create_store", {
        name: `Other Store ${marker}`,
        slug: `other-${marker}`,
        address: "Other address",
        phone: "+27821234567",
        email: "other@example.com",
        city: "Test City",
        province: "Gauteng",
        postalCode: "2000",
      }),
    );

    console.info("FA E2E: fixtures ready; testing login");
    await page.goto("/login");
    await page.getByLabel("Email Address").fill(email);
    await page.getByPlaceholder("Enter your password").fill(password);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page).toHaveURL(/\/franchise\/setup/, { timeout: 45000 });
    await page.goto("/dashboard/franchise/stores");
    await expect(page).toHaveURL(/\/franchise\/setup/);
    await page
      .getByLabel("New permanent password", { exact: true })
      .fill(permanent);
    await page
      .getByLabel("Confirm permanent password", { exact: true })
      .fill(permanent);
    await page.getByRole("checkbox", { name: /Terms of Service/ }).check();
    await page.getByRole("checkbox", { name: /Privacy Policy/ }).check();
    await page.getByRole("button", { name: "Complete account setup" }).click();
    await expect(page).toHaveURL(/\/dashboard\/franchise$/, { timeout: 45000 });
    await expect(
      page
        .getByRole("navigation", { name: "Franchise main navigation" })
        .getByRole("link"),
    ).toHaveCount(3);
    const client = createClient(url, publicKey, {
      auth: { persistSession: false },
    });
    expect(
      (await client.auth.signInWithPassword({ email, password })).error,
    ).not.toBeNull();
    expect(
      (await client.auth.signInWithPassword({ email, password: permanent }))
        .error,
    ).toBeNull();
    expect(
      (
        await client.rpc("franchise_mutation", {
          p_actor: fa,
          p_action: "complete_setup",
          p_data: {},
        })
      ).error,
    ).not.toBeNull();
    expect(
      (await client.from("stores").select("id").eq("id", stores[0])).data,
    ).toEqual([]);
    const denied = await service.rpc("franchise_mutation", {
      p_actor: fa,
      p_action: "update_store",
      p_data: { storeId: stores[0] },
    });
    expect(denied.error?.message).toContain("Store access denied");
    await page.screenshot({
      path: testInfo.outputPath("fa-dashboard-desktop.png"),
      fullPage: true,
    });

    await page.getByRole("link", { name: "Add Store", exact: true }).click();
    for (const [label, value] of [
      ["Store name", `Test Store ${marker}`],
      ["Phone", "0821234567"],
      ["Contact email (optional)", "store@example.com"],
      ["Street address", "123 Verification Road"],
      ["City", "Test City"],
      ["Postal code", "2000"],
    ])
      await page.getByLabel(label, { exact: true }).fill(value);
    await page
      .getByRole("combobox", { name: "Province", exact: true })
      .selectOption("Gauteng");
    await page
      .getByRole("button", { name: "Register Store", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("Store added", {
      timeout: 30000,
    });
    const own = await service
      .from("stores")
      .select("id,franchise_id")
      .eq("name", `Test Store ${marker}`)
      .single();
    expect(own.error).toBeNull();
    expect(own.data!.franchise_id).toBe(franchises[0]);
    stores.push(own.data!.id);
    await page.getByRole("link", { name: "Manage Store", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: `Test Store ${marker}`, exact: true }),
    ).toBeVisible();
    await page
      .getByRole("tab", { name: "Store Settings", exact: true })
      .click();
    await expect(page.locator('input[name="name"]')).toHaveCount(0);
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page
      .getByLabel("Store name", { exact: true })
      .fill(`Updated Store ${marker}`);
    await page
      .getByRole("button", { name: "Save Changes", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Store changes saved",
      { timeout: 30000 },
    );
    const photoForm = page.locator("form").filter({
      has: page.getByRole("heading", {
        name: "Store photograph",
        exact: true,
      }),
    });
    await photoForm
      .locator('input[type="file"]')
      .setInputFiles("public/images/franchise/store-default.png");
    await photoForm
      .getByRole("button", { name: "Upload photograph", exact: true })
      .click();
    await expect(photoForm.getByRole("status")).toContainText(
      "Store photograph updated",
    );
    await expect(
      page.getByRole("img", { name: `Updated Store ${marker} storefront` }),
    ).toHaveAttribute("src", /storage\/v1\/object\/public\/store-images\//);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.locator('input[name="name"]')).toHaveCount(0);
    await page
      .getByRole("tab", { name: "Staff Management", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Staff Directory" }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("fa-management-desktop.png"),
      fullPage: true,
    });
    for (const role of ["manager", "receptionist"]) {
      const limit = role === "manager" ? 3 : 5,
        candidates: string[] = [];
      for (let i = 0; i < limit + 1; i++)
        candidates.push(
          await createAuth(`${role}-${marker}-${i}@example.com`, role, {
            greenchoice_created_by: fa,
            greenchoice_store_id: own.data!.id,
            greenchoice_registration:
              role === "manager" ? "franchise_created" : "manager_created",
            greenchoice_manager_id: fa,
          }),
        );
      const results = await Promise.all(
        candidates.map((authUserId) =>
          service.rpc("franchise_mutation", {
            p_actor: fa,
            p_action: "create_staff",
            p_data: {
              storeId: own.data!.id,
              authUserId,
              role,
              firstName: "Test",
              surname: role,
              phone: "+27821234567",
            },
          }),
        ),
      );
      expect(results.filter((r) => !r.error)).toHaveLength(limit);
      expect(
        results.filter((r) => r.error?.message.includes("limit reached")),
      ).toHaveLength(1);
    }
    console.info(
      "FA E2E: concurrent limits passed; testing staff actions and populated reports",
    );
    await page.reload();
    await page.getByRole("tab", { name: "Staff Management", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Assign Manager", exact: true }),
    ).toBeDisabled();
    const managerCard = page.getByRole("row").filter({ has: page.getByRole("cell", { name: "manager", exact: true }) }).first();
    await managerCard.getByRole("button", { name: "Manage", exact: true }).click();
    const staffForm = page.locator("form").filter({
      has: page.getByRole("button", { name: "Confirm action", exact: true }),
    });
    await staffForm
      .getByRole("combobox", { name: "Action", exact: true })
      .selectOption("restrict_staff");
    await staffForm
      .getByLabel("Your current password", { exact: true })
      .fill(permanent);
    await staffForm
      .getByRole("button", { name: "Confirm action", exact: true })
      .click();
    await expect(staffForm.getByRole("status")).toContainText(
      "Staff details updated",
    );
    await expect(managerCard.getByText("restricted")).toBeVisible();
    await staffForm
      .getByRole("combobox", { name: "Action", exact: true })
      .selectOption("reactivate_staff");
    await staffForm
      .getByLabel("Your current password", { exact: true })
      .fill(permanent);
    await staffForm
      .getByRole("button", { name: "Confirm action", exact: true })
      .click();
    await expect(managerCard.getByText("active")).toBeVisible();
    await staffForm.getByRole("button", { name: "Close", exact: true }).click();

    const category = await service
      .from("categories")
      .select("id")
      .limit(1)
      .single();
    expect(category.error).toBeNull();
    const product = await service
      .from("products")
      .insert({
        store_id: own.data!.id,
        category_id: category.data!.id,
        slug: `fa-verification-${marker}`,
        name: `Verification Product ${marker}`,
        product_name: `Verification Product ${marker}`,
        subcategory_slug: "verification",
        price_cents: 12500,
        price: 125,
        product_status: "active",
        is_published: false,
      })
      .select("id")
      .single();
    expect(product.error).toBeNull();
    expect(
      (
        await service.from("inventory_stock").upsert(
          {
            product_id: product.data!.id,
            store_id: own.data!.id,
            current_quantity: 2,
            low_stock_threshold: 5,
          },
          { onConflict: "product_id" },
        )
      ).error,
    ).toBeNull();
    const sale = await service
      .from("pos_sales")
      .insert({
        store_id: own.data!.id,
        checkout_id: randomUUID(),
        subtotal: 250,
        total: 250,
        status: "completed",
        payment_method: "cash",
        cash_amount: 250,
        card_amount: 0,
        payment_status: "paid",
      })
      .select("id,checkout_id")
      .single();
    expect(sale.error).toBeNull();
    expect(
      (
        await service.from("pos_sale_items").insert({
          sale_id: sale.data!.id,
          product_id: product.data!.id,
          product_name_snapshot: `Verification Product ${marker}`,
          category_snapshot: `Recorded Category ${marker}`,
          quantity: 2,
          unit_price: 125,
          line_total: 250,
        })
      ).error,
    ).toBeNull();
    // A much larger sale from the other franchise must not enter any visible total.
    expect(
      (
        await service.from("pos_sales").insert({
          store_id: stores[0],
          checkout_id: randomUUID(),
          subtotal: 99999,
          total: 99999,
          status: "completed",
        })
      ).error,
    ).toBeNull();
    const visibleSales = await client.from("pos_sales").select("id,total");
    expect(visibleSales.error).toBeNull();
    expect(visibleSales.data).toEqual([{ id: sale.data!.id, total: 250 }]);

    await page.goto("/dashboard/franchise/stores");
    await expect(
      page.getByRole("heading", { name: `Updated Store ${marker}` }),
    ).toBeVisible();
    await expect(page.getByText(`Other Store ${marker}`)).toHaveCount(0);
    await page.getByRole("searchbox").fill("not a matching store");
    await expect(page.getByText("No stores match your search.")).toBeVisible();
    await page.getByRole("searchbox").fill("");
    await page.goto("/dashboard/franchise/sales");
    await expect(
      page.getByRole("heading", {
        name: "Franchise Sales Overview",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("row").filter({ hasText: `Updated Store ${marker}` }),
    ).toContainText(/250[.,]00/);
    const storeHref = await page.getByRole("link", { name: "View Store" }).getAttribute("href");
    console.info("AUD-E2E: using direct navigation to isolate client-link failure");
    await page.goto(storeHref!);
    await expect(
      page.getByRole("heading", { name: "Sales by Category", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(`Recorded Category ${marker}`, { exact: true }),
    ).toBeVisible();
    const recentRegion = page.getByRole("region", { name: "Recent Transactions", exact: true });
    await expect(recentRegion.getByRole("columnheader")).toHaveText(["Date & Time", "Items", "Net Total"]);
    await expect(recentRegion.locator("tbody tr")).toHaveCount(1);
    await expect(recentRegion.locator("tbody tr")).toContainText(/250[.,]00/);
    await expect(recentRegion.locator("tbody tr td").nth(1)).toHaveText("2");
    await expect(
      page
        .getByRole("row")
        .filter({ hasText: `Verification Product ${marker}` }),
    ).toHaveCount(2);
    await page.screenshot({
      path: testInfo.outputPath("fa-analytics-desktop.png"),
      fullPage: true,
    });
    for (const width of [1280, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      ).toBe(true);
    }
    await page.screenshot({
      path: testInfo.outputPath("fa-analytics-mobile.png"),
      fullPage: true,
    });
    await page.goto(`/dashboard/franchise/stores/${stores[0]}`);
    await expect(
      page.getByRole("heading", { name: /This page could not be loaded|Sales Performance could not be loaded|Manage Stores could not be loaded/ }),
    ).toBeVisible();
    await expect(page.getByText(`Other Store ${marker}`)).toHaveCount(0);
    await page.goto("/dashboard/admin/franchises");
    await expect(page).toHaveURL(/\/denied/);
    const unauth = await request.get("/dashboard/franchise");
    expect(unauth.url()).toContain("/login");
  } finally {
    // Resolve every store created under this test's generated franchises, even
    // if a browser assertion failed between creation and capturing the store ID.
    if (franchises.length) {
      const created = await service
        .from("stores")
        .select("id,store_image_path")
        .in("franchise_id", franchises);
      const paths = (created.data || [])
        .map((s) => s.store_image_path)
        .filter((p): p is string => Boolean(p));
      if (paths.length)
        await service.storage.from("store-images").remove(paths);
      for (const store of created.data || [])
        if (!stores.includes(store.id)) stores.push(store.id);
    }
    // Only this test's generated UUIDs are cleaned up; no existing users/stores.
    if (users.length) {
      await service.from("audit_logs").delete().in("user_id", users);
      await service.from("staff_profiles").delete().in("auth_user_id", users);
    }
    if (stores.length) {
      await service.from("audit_logs").delete().in("store_id", stores);
      await service.from("pos_sales").delete().in("store_id", stores);
      await service.from("inventory_stock").delete().in("store_id", stores);
      await service.from("products").delete().in("store_id", stores);
      const removed = await service.from("stores").delete().in("id", stores);
      expect(removed.error).toBeNull();
    }
    if (franchises.length) {
      await service.from("audit_logs").delete().in("record_id", franchises);
      await service.from("franchises").delete().in("id", franchises);
    }
    for (const id of users) await service.auth.admin.deleteUser(id);
  }
});
