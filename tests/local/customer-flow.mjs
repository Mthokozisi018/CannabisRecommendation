// Run against the existing local app backed by isolated staging, using its marked test customer.
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { buildLocalEnvironment, parseEnvFile, validateLocalEnvironment } from "../../scripts/verify-local-environment.mjs";

const env = buildLocalEnvironment(parseEnvFile(readFileSync(".env.staging.local", "utf8")));
assert.deepEqual(validateLocalEnvironment(env), [], "Only isolated staging is allowed");
const local = parseEnvFile(readFileSync(".env.local", "utf8"));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const { data: profile, error } = await admin.from("customer_profiles").select("user_id,email,is_test_account,status").eq("is_test_account", true).eq("status", "active").limit(1).single();
assert.ifError(error);
assert.equal(profile.is_test_account, true);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.addInitScript(() => {
  document.addEventListener("DOMContentLoaded", () => {
    const style = document.createElement("style");
    style.textContent = "nextjs-portal { display: none !important; }";
    document.head.appendChild(style);
  });
});
const page = await context.newPage();
page.setDefaultNavigationTimeout(90_000);
page.setDefaultTimeout(30_000);
const failures = [];
page.on("pageerror", (error) => failures.push(error.message));
const results = [];
let verificationAddressId;
let verificationOrderId;
let originalDefaultId;
let modifiedCart = false;
const out = "tmp/customer-refactor-verification";
mkdirSync(out, { recursive: true });
try {
  await page.goto(`${env.APP_URL}/login`);
  const response = await context.request.post(`${env.APP_URL}/api/auth/login`, { headers: { Origin: env.APP_URL }, data: { email: profile.email, password: local.GREENCHOICE_TEST_CUSTOMER_PASSWORD } });
  const login = await response.json();
  if (response.ok()) {
    assert.equal(login.redirectTo, "/customer/shop");
    results.push("Customer login API lands on Shop");
  } else {
    // The staging test account may have a different password. Obtain an isolated test-only session without email delivery.
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: profile.email });
    assert.ifError(linkError);
    const cookies = new Map();
    const client = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { cookies: { getAll: () => [...cookies.values()], setAll: (next) => next.forEach((cookie) => cookies.set(cookie.name, cookie)) } });
    const { error: verifyError } = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
    assert.ifError(verifyError);
    await context.addCookies([...cookies.values()].map((cookie) => ({ name: cookie.name, value: cookie.value, url: env.APP_URL, httpOnly: false, sameSite: "Lax" })));
    results.push("Authenticated staging test session; password login unavailable for configured test password");
  }
  const access = await context.request.get(`${env.APP_URL}/api/auth/access-decision`);
  const decision = await access.json();
  assert.equal(decision.redirectTo, "/customer/shop");
  results.push("Authenticated customer access decision selects Shop");
  const destinations = ["Shop", "Cart", "Orders", "Alerts", "Addresses"];
  for (const label of process.env.GREENCHOICE_CUSTOMER_ORDER_ONLY === "true" ? [] : destinations) {
    const path = label.toLowerCase();
    await page.goto(`${env.APP_URL}/customer/${path}`);
    await expect(page.getByRole("heading", { name: label, exact: true })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Customer navigation" });
    assert.deepEqual(await nav.locator("a > span:last-child").allTextContents(), destinations);
    await expect(nav.getByRole("link", { name: label, exact: label !== "Cart" })).toHaveAttribute("aria-current", "page");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${label} fits mobile`);
    await page.screenshot({ path: `${out}/${path}-mobile.png`, fullPage: true });
    await page.reload();
    await expect(page.getByRole("heading", { name: label, exact: true })).toBeVisible();
    results.push(`${label}: direct URL, refresh, authenticated data, mobile width and selected tab`);
    console.log(`Verified ${label}`);
  }
  await page.goto(`${env.APP_URL}/customer`);
  await page.waitForURL("**/customer/shop");
  results.push("Legacy Home redirects to Shop");
  await page.goto(`${env.APP_URL}/customer/stores`);
  await page.waitForURL("**/customer/shop");
  results.push("Legacy store directory redirects to Shop");
  if (process.env.GREENCHOICE_CUSTOMER_FULL_FLOW === "true") {
    if (process.env.GREENCHOICE_CUSTOMER_ORDER_ONLY !== "true") {
    const { data: originalAddresses } = await admin.from("customer_addresses").select("id,is_default").eq("user_id", profile.user_id);
    originalDefaultId = originalAddresses.find((address) => address.is_default)?.id;
    const label = `Refactor test ${Date.now()}`;
    await page.getByRole("navigation", { name: "Customer navigation" }).getByRole("link", { name: "Addresses" }).click();
    await page.getByRole("button", { name: "Add address", exact: true }).click();
    for (const [name, value] of [["Label", label], ["Street address", "2 Synthetic Test Avenue"], ["Suburb", "Hatfield"], ["City", "Pretoria"], ["Postal code", "0001"]]) await page.getByLabel(name, { exact: true }).fill(value);
    await page.getByRole("button", { name: "Save address", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Address added.");
    const { data: saved } = await admin.from("customer_addresses").select("id").eq("user_id", profile.user_id).eq("label", label).single();
    verificationAddressId = saved.id;
    const card = page.locator("article").filter({ has: page.getByRole("heading", { name: label, exact: true }) });
    await card.getByRole("button", { name: /^Edit / }).click();
    await page.getByLabel("City", { exact: true }).fill("Johannesburg");
    await page.getByRole("button", { name: "Save address", exact: true }).click();
    await expect(card).toContainText("Johannesburg");
    await card.getByRole("button", { name: "Use as default" }).click();
    await expect(card.getByText("Default", { exact: true })).toBeVisible();
    await page.reload();
    await expect(card.getByText("Default", { exact: true })).toBeVisible();
    if (originalDefaultId) {
      const original = page.locator("article").filter({ hasNot: page.getByRole("heading", { name: label, exact: true }) });
      const { data: originalDefault } = await admin.from("customer_addresses").select("label").eq("id", originalDefaultId).single();
      await original.filter({ has: page.getByRole("heading", { name: originalDefault.label, exact: true }) }).getByRole("button", { name: "Use as default" }).click();
      await expect(page.getByRole("status")).toHaveText("Default address updated.");
    }
    await card.getByRole("button", { name: /^Delete / }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete address", exact: true }).click();
    await expect(card).toHaveCount(0);
    verificationAddressId = undefined;
    results.push("Address add, edit, default selection, refresh persistence, restore original default and delete via UI");
    console.log("Verified address management");
    }

    const { data: draftItems } = await admin.from("carts").select("id,cart_items(id)").eq("created_by_user_id", profile.user_id).eq("status", "draft");
    assert.equal(draftItems.flatMap((cart) => cart.cart_items).length, 0, "Full flow requires an empty test cart");
    modifiedCart = true;
    const { data: stock } = await admin.from("inventory_stock").select("store_id,current_quantity,products!inner(id,category,subcategory,product_name)").eq("products.category", "Accessories").gt("current_quantity", 2).limit(1).single();
    assert.ok(stock);
    const { data: historyBefore } = await admin.from("orders").select("id").eq("customer_id", profile.user_id);
    await page.getByRole("navigation", { name: "Customer navigation" }).getByRole("link", { name: "Shop", exact: true }).click();
    await page.locator(`a[href="/customer/stores/${stock.store_id}"]`).click();
    await page.getByRole("button", { name: "Accessories", exact: true }).click();
    await page.getByRole("button").filter({ hasText: stock.products.subcategory }).first().click();
    await page.getByRole("button", { name: "Add to cart", exact: true }).first().click();
    await expect(page.getByRole("button", { name: "Added", exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Customer navigation" }).getByRole("link", { name: /Cart/ })).toContainText("1");
    await page.getByRole("navigation", { name: "Customer navigation" }).getByRole("link", { name: /Cart/ }).click();
    await page.getByRole("button", { name: /^Add one / }).click();
    await expect(page.getByRole("navigation", { name: "Customer navigation" }).getByRole("link", { name: /Cart/ })).toContainText("2");
    await page.getByRole("button", { name: /^Remove one / }).click();
    await expect(page.getByRole("navigation", { name: "Customer navigation" }).getByRole("link", { name: /Cart/ })).toContainText("1");
    await page.getByRole("link", { name: "Proceed to checkout" }).click();
    await page.getByLabel(/Phone Number/).fill("0820000001");
    await page.getByRole("button", { name: "Continue to Review" }).click();
    await page.getByLabel("Cash", { exact: false }).locator("..").click();
    await expect(page.getByLabel("Cash", { exact: false })).toBeChecked();
    await page.getByRole("button", { name: "Place Order", exact: true }).click();
    await page.waitForURL(/\/customer\/orders\/[^/]+\/confirmed$/);
    verificationOrderId = page.url().split("/").at(-2);
    const { data: created } = await admin.from("orders").select("customer_id,store_id,status").eq("id", verificationOrderId).single();
    assert.equal(created.customer_id, profile.user_id);
    assert.equal(created.store_id, stock.store_id);
    results.push("Storefront category/filter browsing, add to cart, increase/decrease, checkout, confirmed order customer/store ownership");
    await page.goto(`${env.APP_URL}/customer/orders`);
    await expect(page.locator(`a[href="/customer/orders/${verificationOrderId}"]`)).toBeVisible();
    await page.goto(`${env.APP_URL}/customer/alerts`);
    await expect(page.locator(`a[href="/customer/orders/${verificationOrderId}"]`).first()).toBeVisible();
    await page.locator(`a[href="/customer/orders/${verificationOrderId}"]`).first().click();
    await page.waitForURL(`**/customer/orders/${verificationOrderId}`);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Cancel order", exact: false }).click({ timeout: 90_000 });
    await expect(page.getByText("Cancelled", { exact: true }).first()).toBeVisible();
    const { data: historyAfter } = await admin.from("orders").select("id").eq("customer_id", profile.user_id);
    assert.ok(historyBefore.every((order) => historyAfter.some((saved) => saved.id === order.id)));
    await page.goto(`${env.APP_URL}/customer/orders?view=history&status=cancelled`);
    await expect(page.locator(`a[href="/customer/orders/${verificationOrderId}"]`)).toBeVisible();
    verificationOrderId = undefined;
    const { data: returnedStock } = await admin.from("inventory_stock").select("current_quantity").eq("store_id", stock.store_id).eq("product_id", stock.products.id).single();
    assert.equal(returnedStock.current_quantity, stock.current_quantity);
    results.push("Order visible in Orders and Alerts; cancellation returns stock and keeps existing history");
  }
  console.log(JSON.stringify({ results, failures, shopLinks: await page.locator('a[href^="/customer/stores/"]').count() }, null, 2));
  writeFileSync(`${out}/results.json`, JSON.stringify({ results, failures }, null, 2));
  assert.deepEqual(failures, []);
} catch (error) {
  await page.screenshot({ path: `${out}/failure.png`, fullPage: true }).catch(() => {});
  console.error(JSON.stringify({ stage: page.url(), results, failure: error.message }));
  throw error;
} finally {
  if (verificationAddressId) {
    await admin.from("customer_addresses").delete().eq("id", verificationAddressId).eq("user_id", profile.user_id);
    if (originalDefaultId) await admin.from("customer_addresses").update({ is_default: true }).eq("id", originalDefaultId).eq("user_id", profile.user_id);
  }
  if (verificationOrderId) await admin.rpc("cancel_customer_order", { p_order_id: verificationOrderId, p_customer_user_id: profile.user_id, p_reason: "Synthetic customer refactor verification cleanup" });
  if (modifiedCart) await context.request.delete(`${env.APP_URL}/api/customer/cart`, { headers: { Origin: env.APP_URL } });
  await context.close();
  await browser.close();
}
