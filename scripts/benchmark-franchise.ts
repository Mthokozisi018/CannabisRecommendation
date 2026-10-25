// Read-only staging benchmark. Never prints credentials or customer/staff data.
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
const franchise = "ec7730b6-27b2-4d86-8ba6-16c387060831";
let requests: { ms: number; bytes: number; status: number; path: string }[] =
  [];
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false },
    global: {
      fetch: async (input, init) => {
        const start = performance.now(),
          response = await fetch(input, init);
        const bytes = (await response.clone().arrayBuffer()).byteLength;
        requests.push({
          ms: Math.round(performance.now() - start),
          bytes,
          status: response.status,
          path: new URL(String(input)).pathname,
        });
        return response;
      },
    },
  },
);
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
  const results = [];
  for (let iteration = 0; iteration < 3; iteration++) {
    for (const page of ["home", "sales"]) {
      requests = [];
      const start = performance.now(),
        stores = await directory();
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
      results.push({
        iteration,
        page,
        ms: Math.round(performance.now() - start),
        requestCount: requests.length,
        bytes: requests.reduce((n, r) => n + r.bytes, 0),
        requests,
      });
    }
  }
  writeFileSync(
    "docs/franchise-performance-before.json",
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        conditions:
          "Staging REST from local workstation, server credential; excludes auth/RLS cost, browser rendering and JS aggregation",
        results,
      },
      null,
      2,
    ),
  );
  console.log(
    results.map(({ iteration, page, ms, requestCount, bytes }) => ({
      iteration,
      page,
      ms,
      requestCount,
      bytes,
    })),
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
