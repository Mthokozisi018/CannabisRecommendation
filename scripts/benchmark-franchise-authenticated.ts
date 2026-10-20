// Opt-in synthetic staging fixture benchmark. Existing records are read-only.
import { randomUUID } from "node:crypto";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { reportPeriod, localDay } from "../lib/franchise/reporting";
import { currentCalendarKpiBounds } from "../lib/manager/report-calendar";
const project = "jezbvjepxosphdrykrcg";
if (
  process.env.GREENCHOICE_ENV !== "staging" ||
  new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname !==
    `${project}.supabase.co`
)
  throw Error("Staging required");
let franchise = "";
const sourceFranchise = "ec7730b6-27b2-4d86-8ba6-16c387060831";
let requests: { ms: number; bytes: number; status: number; path: string }[] =
  [];
const service = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false },
  },
);
let db = service;
async function measuredFetch(input: RequestInfo | URL, init?: RequestInit) {
  const start = performance.now(),
    response = await fetch(input, init);
  requests.push({
    ms: Math.round(performance.now() - start),
    bytes: (await response.clone().arrayBuffer()).byteLength,
    status: response.status,
    path: new URL(String(input)).pathname,
  });
  return response;
}

async function all(
  query: (
    offset: number,
  ) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
) {
  const rows: unknown[] = [];
  for (let offset = 0; ; offset += 500) {
    const r = await query(offset);
    if (r.error) throw r.error;
    rows.push(...(r.data || []));
    if ((r.data?.length || 0) < 500) return rows;
  }
}
async function directory() {
  const [f, stores] = await Promise.all([
    db
      .from("franchises")
      .select(
        "id,name,registration_number,contact_email,phone,address,created_at",
      )
      .eq("id", franchise)
      .single(),
    all((o) =>
      db
        .from("stores")
        .select(
          "id,franchise_id,name,slug,is_active,store_access_status,physical_store_address,city,province,postal_code,store_phone_number,store_contact_email,store_image_url,opening_hours,created_at",
        )
        .eq("franchise_id", franchise)
        .order("id")
        .range(o, o + 499),
    ),
    all((o) =>
      db
        .from("staff_profiles")
        .select(
          "id,auth_user_id,store_id,full_name,first_name,surname,email,phone_number,mobile_number,role,account_status,assigned_at,created_at,stores!inner(franchise_id)",
        )
        .eq("stores.franchise_id", franchise)
        .in("role", ["manager", "receptionist"])
        .neq("account_status", "deleted")
        .order("id")
        .range(o, o + 499),
    ),
  ]);
  if (f.error) throw f.error;
  return stores as { id: string }[];
}
async function main() {
  if (process.env.GREENCHOICE_FA_BENCHMARK !== "true")
    throw Error(
      "Set GREENCHOICE_FA_BENCHMARK=true for isolated staging fixtures",
    );
  const marker = randomUUID().slice(0, 8),
    email = `fa-benchmark-${marker}@example.invalid`;
  const password = `Tz!8${randomUUID()}xQ`,
    permanent = `Yk!9${randomUUID()}pZ`;
  let authId: string | undefined;
  let profileId: string | undefined;
  const storeIds: string[] = [];
  const results = [];
  try {
    const admin = await service
      .from("staff_profiles")
      .select("auth_user_id")
      .eq("role", "admin")
      .eq("account_status", "active")
      .limit(1)
      .single();
    if (admin.error) throw admin.error;
    const rpc = async (
      actor: string,
      action: string,
      data: Record<string, unknown>,
    ) => {
      const r = await service.rpc("franchise_mutation", {
        p_actor: actor,
        p_action: action,
        p_data: data,
      });
      if (r.error) throw r.error;
      return String(r.data);
    };
    franchise = await rpc(admin.data.auth_user_id, "create_franchise", {
      name: `Benchmark ${marker}`,
      email,
      address: "Synthetic test address",
      phone: "+27821234567",
      registrationNumber: "",
    });
    const auth = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: {
        greenchoice_role: "franchise_admin",
        greenchoice_created_by: admin.data.auth_user_id,
        greenchoice_franchise_id: franchise,
      },
    });
    if (auth.error) throw auth.error;
    authId = auth.data.user.id;
    profileId = await rpc(admin.data.auth_user_id, "create_fa", {
      franchiseId: franchise,
      authUserId: authId,
      firstName: "Benchmark",
      surname: "Administrator",
      phone: "+27821234567",
    });
    db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false }, global: { fetch: measuredFetch } },
    );
    const login = await db.auth.signInWithPassword({ email, password });
    if (login.error) throw login.error;
    const changed = await db.auth.updateUser({ password: permanent });
    if (changed.error) throw changed.error;
    await rpc(authId, "complete_setup", {
      termsVersion: "v1.0",
      privacyVersion: "v1.0",
    });
    const sources = await service
      .from("stores")
      .select("id")
      .eq("franchise_id", sourceFranchise)
      .order("id");
    if (sources.error) throw sources.error;
    let sourceTransactions = 0;
    for (const [index, source] of sources.data.entries()) {
      const id = await rpc(authId, "create_store", {
        name: `Benchmark Store ${index + 1}`,
        slug: `benchmark-${marker}-${index}`,
        address: "Synthetic address",
        city: "Test City",
        province: "Gauteng",
        postalCode: "2000",
        phone: "+27821234567",
        email,
      });
      storeIds.push(id);
      const sales = [];
      for (let o = 0; ; o += 500) {
        const r = await service
          .from("pos_sales")
          .select("total,created_at")
          .eq("store_id", source.id)
          .eq("status", "completed")
          .order("id")
          .range(o, o + 499);
        if (r.error) throw r.error;
        sales.push(...r.data);
        if (r.data.length < 500) break;
      }
      sourceTransactions += sales.length;
      for (let o = 0; o < sales.length; o += 500) {
        const r = await service.from("pos_sales").insert(
          sales.slice(o, o + 500).map((s) => ({
            store_id: id,
            checkout_id: randomUUID(),
            total: s.total,
            subtotal: s.total,
            status: "completed",
            created_at: s.created_at,
            payment_method: "cash",
            payment_status: "paid",
            cash_amount: s.total,
            card_amount: 0,
          })),
        );
        if (r.error) throw r.error;
      }
      const count = await service
        .from("pos_customers")
        .select("id", { head: true, count: "exact" })
        .eq("store_id", source.id)
        .is("deleted_at", null);
      if (count.error) throw count.error;
      const customers = Array.from({ length: count.count || 0 }, (_, i) => ({
        store_id: id,
        first_name: "Synthetic",
        surname: `Customer ${i}`,
        full_name: `Synthetic Customer ${i}`,
        phone_normalized: `+2782${String(i).padStart(7, "0")}`,
        phone_digits: `082${String(i).padStart(7, "0")}`,
        phone_display: `082${String(i).padStart(7, "0")}`,
      }));
      if (customers.length) {
        const r = await service.from("pos_customers").insert(customers);
        if (r.error) throw r.error;
      }
    }
    console.log({
      fixtureStores: storeIds.length,
      fixtureTransactions: sourceTransactions,
    });

    for (
      let iteration = 0;
      iteration <
      (process.env.GREENCHOICE_FA_BENCHMARK_BROWSER_ONLY === "true" ? 0 : 3);
      iteration++
    ) {
      for (const mode of ["before", "after"]) {
        for (const page of ["home", "sales"]) {
          requests = [];
          const start = performance.now();
          if (mode === "after") {
            const day = localDay(new Date()),
              p = reportPeriod({});
            const startDate =
              page === "home"
                ? new Date(`${day}T00:00:00+02:00`)
                : new Date(
                    Math.min(
                      p.start.getTime(),
                      Date.parse(`${day.slice(0, 4)}-01-01T00:00:00+02:00`),
                      currentCalendarKpiBounds().week.start.getTime(),
                    ),
                  );
            const endDate =
              page === "home"
                ? new Date(startDate.getTime() + 86400000)
                : new Date(Math.max(p.end.getTime(), Date.now() + 86400000));
            const tasks: PromiseLike<unknown>[] = [
              page === "sales"
                ? directory()
                : Promise.all([
                    db
                      .from("franchises")
                      .select(
                        "id,name,registration_number,contact_email,phone,address,created_at",
                      )
                      .eq("id", franchise)
                      .single()
                      .then((r) => {
                        if (r.error) throw r.error;
                      }),
                    all((o) =>
                      db
                        .from("staff_profiles")
                        .select(
                          "id,auth_user_id,full_name,email,role,account_status,stores!inner(franchise_id)",
                        )
                        .eq("stores.franchise_id", franchise)
                        .eq("role", "manager")
                        .neq("account_status", "deleted")
                        .order("id")
                        .range(o, o + 499),
                    ),
                  ]),
              db
                .rpc("franchise_dashboard_totals", {
                  p_franchise_id: franchise,
                  p_start: startDate.toISOString(),
                  p_end: endDate.toISOString(),
                  p_store_id: null,
                  p_customers: page === "sales",
                })
                .then((r) => {
                  if (r.error) throw r.error;
                  assert.ok(r.data);
                }),
            ];
            if (page === "home")
              tasks.push(
                all((o) =>
                  db
                    .from("audit_logs")
                    .select("user_id,details,stores!inner(franchise_id)")
                    .eq("stores.franchise_id", franchise)
                    .eq("action", "login_success")
                    .gte("created_at", startDate.toISOString())
                    .lt("created_at", endDate.toISOString())
                    .contains("details", { role: "manager" })
                    .order("id")
                    .range(o, o + 499),
                ),
              );
            await Promise.all(tasks);
          } else {
            const stores = await directory();
            if (page === "home") {
              const day = `${localDay(new Date())}T00:00:00+02:00`;
              await Promise.all([
                all((o) =>
                  db
                    .from("audit_logs")
                    .select(
                      "id,user_id,store_id,created_at,result,details,stores!inner(franchise_id)",
                    )
                    .eq("stores.franchise_id", franchise)
                    .eq("action", "login_success")
                    .gte("created_at", day)
                    .order("id")
                    .range(o, o + 499),
                ),
                all((o) =>
                  db
                    .from("pos_sales")
                    .select("total,stores!inner(franchise_id)")
                    .eq("stores.franchise_id", franchise)
                    .eq("status", "completed")
                    .gte("created_at", day)
                    .lt(
                      "created_at",
                      new Date(Date.parse(day) + 86400000).toISOString(),
                    )
                    .order("id")
                    .range(o, o + 499),
                ),
              ]);
            } else {
              const p = reportPeriod({}),
                day = localDay(new Date());
              const earliest = new Date(
                Math.min(
                  p.start.getTime(),
                  Date.parse(`${day.slice(0, 4)}-01-01T00:00:00+02:00`),
                  currentCalendarKpiBounds().week.start.getTime(),
                ),
              );
              await all((o) =>
                db
                  .from("pos_sales")
                  .select(
                    "id,store_id,customer_id,staff_user_id,checkout_id,total,payment_method,created_at,stores!inner(franchise_id)",
                  )
                  .eq("stores.franchise_id", franchise)
                  .eq("status", "completed")
                  .gte("created_at", earliest.toISOString())
                  .lt(
                    "created_at",
                    new Date(
                      Math.max(p.end.getTime(), Date.now() + 86400000),
                    ).toISOString(),
                  )
                  .order("id")
                  .range(o, o + 499),
              );
              await Promise.all(
                stores.map(async (s) => {
                  const r = await db
                    .from("pos_customers")
                    .select("id", { head: true, count: "exact" })
                    .eq("store_id", s.id)
                    .is("deleted_at", null);
                  if (r.error) throw r.error;
                }),
              );
            }
          }
          results.push({
            iteration,
            mode,
            page,
            ms: Math.round(performance.now() - start),
            requestCount: requests.length,
            bytes: requests.reduce((n, r) => n + r.bytes, 0),
            requests,
          });
        }
      }
    }
    // Reconcile the complete 90-day aggregate against known source demo totals.
    const totals = await db.rpc("franchise_dashboard_totals", {
      p_franchise_id: franchise,
      p_start: "2026-07-14T22:00:00Z",
      p_end: "2026-10-12T22:00:00Z",
    });
    if (totals.error) throw totals.error;
    assert.equal(
      totals.data.daily.reduce(
        (n: number, r: { transactions: number }) => n + Number(r.transactions),
        0,
      ),
      3749,
    );
    assert.equal(
      totals.data.daily.reduce(
        (n: number, r: { revenue: number }) =>
          n + Math.round(Number(r.revenue) * 100),
        0,
      ),
      157677500,
    );
    writeFileSync(
      process.env.GREENCHOICE_FA_BENCHMARK_BROWSER_ONLY === "true"
        ? "docs/franchise-performance-browser-final.json"
        : "docs/franchise-performance-authenticated.json",
      JSON.stringify(
        {
          measuredAt: new Date().toISOString(),
          conditions:
            "Authenticated staging fixture, same workstation/session/date range; 6 stores and 3749 sales, RLS active; excludes session resolution and React calculation",
          results,
        },
        null,
        2,
      ),
    );
    console.log(
      results.map(({ iteration, mode, page, ms, requestCount, bytes }) => ({
        iteration,
        mode,
        page,
        ms,
        requestCount,
        bytes,
      })),
    );
    const browser = await chromium.launch();
    const browserResults = [];
    try {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
      });
      page.setDefaultNavigationTimeout(90000);
      page.setDefaultTimeout(60000);
      await page.goto("http://127.0.0.1:3001/login");
      await page.getByLabel("Email Address").fill(email);
      await page.getByPlaceholder("Enter your password").fill(permanent);
      await page.getByRole("button", { name: "Sign In", exact: true }).click();
      await page.waitForURL(/\/dashboard\/franchise$/, { timeout: 60000 });
      for (const route of [
        "/dashboard/franchise",
        "/dashboard/franchise/sales",
      ]) {
        for (let i = 0; i < 3; i++) {
          const t = performance.now();
          await page.goto("http://127.0.0.1:3001" + route, {
            waitUntil: "commit",
          });
          await page
            .locator(
              'h1, [role="status"], nav[aria-label="Franchise main navigation"]',
            )
            .first()
            .waitFor();
          const contentVisibleMs = Math.round(performance.now() - t);
          await page
            .getByRole("heading", {
              name: route.endsWith("sales")
                ? "Franchise Sales Overview"
                : `Benchmark ${marker}`,
              exact: true,
            })
            .waitFor();
          if (route.endsWith("sales"))
            await page
              .getByRole("heading", { name: "Store Performance", exact: true })
              .waitFor();
          else
            await page
              .getByText("Total Franchise Sales Today", { exact: true })
              .waitFor();
          browserResults.push({
            route,
            iteration: i,
            dataVisibleMs: Math.round(performance.now() - t),
            contentVisibleMs,
          });
        }
      }
      for (const width of [1440, 1280, 1024, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        for (const route of [
          "/dashboard/franchise",
          "/dashboard/franchise/sales",
          "/dashboard/franchise/stores",
          "/dashboard/franchise/stores/new",
          `/dashboard/franchise/stores/${storeIds[0]}`,
          `/dashboard/franchise/sales/${storeIds[0]}`,
        ]) {
          await page.goto("http://127.0.0.1:3001" + route);
          await page.locator("h1").first().waitFor();
          assert.equal(
            await page.evaluate(
              () =>
                document.documentElement.scrollWidth <=
                document.documentElement.clientWidth,
            ),
            true,
            `${route} overflow at ${width}`,
          );
          if (route === "/dashboard/franchise")
            assert.equal(
              await page
                .getByRole("navigation", { name: "Franchise main navigation" })
                .getByRole("link")
                .count(),
              3,
            );
          if (route.includes("/stores/") && !route.endsWith("new"))
            for (const name of [
              "Store Manager",
              "Staff Management",
              "Store Settings",
            ]) {
              await page.getByRole("tab", { name, exact: true }).click();
              assert.equal(await page.getByRole("tabpanel").isVisible(), true);
            }
        }
      }
      await page.goto("http://127.0.0.1:3001/dashboard/franchise/sales");
      let documentRequests = 0;
      page.on("request", (r) => {
        if (r.resourceType() === "document") documentRequests++;
      });
      const periodTableRegion = page.getByRole("region", {
        name: "Store Performance",
        exact: true,
      });
      await periodTableRegion.getByRole("combobox").selectOption("custom");
      await periodTableRegion
        .getByLabel("Store Performance from", { exact: true })
        .fill("2026-07-15");
      await periodTableRegion
        .getByLabel("Store Performance to", { exact: true })
        .fill("2026-10-12");
      await periodTableRegion
        .getByRole("button", { name: "Apply", exact: true })
        .click();
      await expect
        .poll(
          async () =>
            page
              .locator("table tbody tr")
              .evaluateAll((rows) =>
                rows.reduce(
                  (n, row) => n + Number(row.children[3]?.textContent || 0),
                  0,
                ),
              ),
          { timeout: 60000 },
        )
        .toBe(3749);
      assert.equal(
        documentRequests,
        0,
        "Period changes must use client navigation",
      );
      await page.screenshot({
        path: "tmp/franchise-performance-mobile.png",
        fullPage: true,
      });
    } finally {
      await browser.close();
    }
    writeFileSync(
      process.env.GREENCHOICE_FA_BENCHMARK_BROWSER_ONLY === "true"
        ? "docs/franchise-performance-browser-final.json"
        : "docs/franchise-performance-authenticated.json",
      JSON.stringify(
        {
          measuredAt: new Date().toISOString(),
          conditions: `Local workstation to staging; authenticated synthetic FA fixture, 6 stores / 3749 sales / matching customer counts; same session, date range and fetch instrumentation; data pipeline excludes session resolution and React calculation; browser is ${process.env.GREENCHOICE_BENCHMARK_SERVER_MODE || "Next dev"}, full navigation`,
          results,
          browserResults,
        },
        null,
        2,
      ),
    );
    console.log(
      results.map(({ iteration, mode, page, ms, requestCount, bytes }) => ({
        iteration,
        mode,
        page,
        ms,
        requestCount,
        bytes,
      })),
    );
    console.log(browserResults);
  } finally {
    // Strictly scoped cleanup; none of the source demo or existing account data is written.
    if (storeIds.length) {
      for (const table of ["audit_logs", "pos_sales", "pos_customers"]) {
        const r = await service.from(table).delete().in("store_id", storeIds);
        if (r.error) throw r.error;
      }
      await service
        .from("pos_customer_search_outbox")
        .delete()
        .in("store_id", storeIds);
      const r = await service.from("stores").delete().in("id", storeIds);
      if (r.error) throw r.error;
    }
    if (profileId)
      await service.from("audit_logs").delete().eq("record_id", profileId);
    if (authId) {
      await service.from("audit_logs").delete().eq("user_id", authId);
      await service.from("staff_profiles").delete().eq("auth_user_id", authId);
      const r = await service.auth.admin.deleteUser(authId);
      if (r.error) throw r.error;
    }
    if (franchise) {
      await service.from("audit_logs").delete().eq("record_id", franchise);
      const r = await service.from("franchises").delete().eq("id", franchise);
      if (r.error) throw r.error;
    }
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
