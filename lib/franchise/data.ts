import "server-only";
import { netSaleCents } from "@/lib/sales-money";
import { allocateNetItemCents } from "./net-item-allocation";
import { cache } from "react";
import { getManagerLoginHistory } from "./manager-login-history";
import { cachedFranchiseTotals, type DashboardTotals } from "./totals-cache";
import { adjustLegacyTotals, type RefundedSale } from "./legacy-totals";
import { requireFranchiseAdmin, requireFranchiseStore } from "./auth";
import type {
  Franchise,
  FranchiseStaff,
  FranchiseStore,
  LoginRecord,
} from "./types";
import {
  localDay,
  reportPeriod,
  summarizeDailyTotals,
  summarizeSaleItems,
  type FranchiseSale,
  type FranchiseSaleItem,
} from "./reporting";
import { currentCalendarKpiBounds } from "@/lib/manager/report-calendar";
import { inventoryStockLevel } from "@/lib/manager/stock-level";
import { historicalReportingPeriod } from "./revenue-reporting";
import {
  buildManagerSalesReport,
  parseSalesReportFilters,
} from "@/lib/manager/sales-overview";
import type { DashboardSession } from "@/lib/dashboard-session";

// Showcase transactions are voided and cannot enter ordinary sales reporting. Only
// their assigned franchise administrator may include them in demo analytics.
function showcaseSaleStatus(session?: DashboardSession): "completed" | "voided" {
  const metadata = session?.user?.app_metadata;
  return metadata?.greenchoice_demo_mode === "historical"
    && metadata?.greenchoice_franchise_id === session?.profile?.franchise_id
    ? "voided" : "completed";
}

export async function readAll<T>(
  query: (
    offset: number,
  ) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await query(offset);
    if (result.error)
      throw new Error("Franchise data could not be loaded. Please retry.");
    const batch = (result.data || []) as T[];
    rows.push(...batch);
    if (batch.length < 500) return rows;
  }
}
export const getFranchiseDirectory = cache(async (storeId?: string) => {
  const context = await requireFranchiseAdmin();
  const { supabase, franchiseId } = context;
  const [franchise, stores, staff] = await Promise.all([
    supabase
      .from("franchises")
      .select(
        "id,name,registration_number,contact_email,phone,address,created_at",
      )
      .eq("id", franchiseId)
      .single<Franchise>(),
    readAll<FranchiseStore>((offset) =>
      supabase
        .from("stores")
        .select(
          "id,franchise_id,name,slug,is_active,store_access_status,physical_store_address,city,province,postal_code,store_phone_number,store_contact_email,store_image_url,opening_hours,created_at",
        )
        .eq("franchise_id", franchiseId)
        .filter(storeId ? "id" : "franchise_id", "eq", storeId || franchiseId)
        .order("id")
        .range(offset, offset + 499),
    ),
    readAll<FranchiseStaff>((offset) =>
      supabase
        .from("staff_profiles")
        .select(
          "id,auth_user_id,store_id,full_name,first_name,surname,email,phone_number,mobile_number,role,account_status,assigned_at,created_at,stores!inner(franchise_id)",
        )
        .eq("stores.franchise_id", franchiseId)
        .filter(
          storeId ? "store_id" : "stores.franchise_id",
          "eq",
          storeId || franchiseId,
        )
        .in("role", ["manager", "receptionist"])
        .neq("account_status", "deleted")
        .order("id")
        .range(offset, offset + 499),
    ),
  ]);
  if (franchise.error || !franchise.data)
    throw new Error("Franchise could not be loaded.");
  return { ...context, franchise: franchise.data, stores, staff };
});
export async function getStoreManagement(storeId: string) {
  const context = await requireFranchiseStore(storeId);
  const { supabase } = context;
  const [staff, logins, managerHistory] = await Promise.all([
    readAll<FranchiseStaff>((o) =>
      supabase
        .from("staff_profiles")
        .select(
          "id,auth_user_id,store_id,full_name,first_name,surname,email,phone_number,mobile_number,role,account_status,assigned_at,created_at",
        )
        .eq("store_id", storeId)
        .in("role", ["manager", "receptionist"])
        .neq("account_status", "deleted")
        .order("id")
        .range(o, o + 499),
    ),
    supabase
      .from("audit_logs")
      .select("id,user_id,store_id,created_at,result,details")
      .eq("store_id", storeId)
      .eq("action", "login_success")
      .order("created_at", { ascending: false })
      .limit(100),
    getManagerLoginHistory(storeId),
  ]);
  if (logins.error) throw new Error("Login history could not be loaded.");
  return {
    store: context.store,
    managerHistory,
    staff,
    logins: (logins.data || []) as LoginRecord[],
  };
}
export async function getStoreSaleItems(
  storeId: string,
  period: ReturnType<typeof reportPeriod>,
) {
  const { supabase, franchiseId, session } = await requireFranchiseStore(storeId);
  // Resolve authorized sales before reading items. Filtering through an embedded
  // sales join made the item query time out when franchise RLS was active.
  const sales = await readAll<{ id: string }>((offset) =>
    supabase
      .from("pos_sales")
      .select("id,stores!inner(franchise_id)")
      .eq("stores.franchise_id", franchiseId)
      .eq("store_id", storeId)
      .eq("status", showcaseSaleStatus(session))
      .gte("created_at", period.start.toISOString())
      .lt("created_at", period.end.toISOString())
      .order("id")
      .range(offset, offset + 499),
  );
  const items: FranchiseSaleItem[] = [];
  for (let index = 0; index < sales.length; index += 100) {
    const saleIds = sales.slice(index, index + 100).map((sale) => sale.id);
    items.push(
      ...(await readAll<FranchiseSaleItem>((offset) =>
        supabase
          .from("pos_sale_items")
          .select(
            "sale_id,product_name_snapshot,category_snapshot,subcategory_snapshot,quantity,unit_price,line_total",
          )
          .in("sale_id", saleIds)
          .order("id")
          .range(offset, offset + 499),
      )),
    );
  }
  return items;
}
export async function getStoreReportDetails(storeId: string, period: ReturnType<typeof reportPeriod>) {
  const { supabase, franchiseId, session } = await requireFranchiseStore(storeId);
  const demo = showcaseSaleStatus(session) === "voided";
  const [aggregate, recent] = await Promise.all([
    demo ? Promise.resolve({ data: null, error: { code: "PGRST202" } })
      : supabase.rpc("franchise_store_item_totals", { p_store_id: storeId, p_start: period.start.toISOString(), p_end: period.end.toISOString() }),
    supabase.from("pos_sales").select("id,store_id,customer_id,staff_user_id,checkout_id,total,refunded_amount,payment_method,created_at")
      .eq("store_id",storeId).eq("status",showcaseSaleStatus(session)).gte("created_at",period.start.toISOString()).lt("created_at",period.end.toISOString())
      .order("created_at",{ascending:false}).order("id").limit(20),
  ]);
  if (aggregate.error && aggregate.error.code !== "PGRST202") throw new Error("Product totals could not be loaded. Please retry.");
  if (!aggregate.error && !aggregate.data) throw new Error("Product totals could not be loaded. Please retry.");
  if (recent.error) throw new Error("Transactions could not be loaded. Please retry.");
  const totals = aggregate.error?.code === "PGRST202"
    ? await readCompatibleStoreItemTotals(supabase, franchiseId, storeId, period, showcaseSaleStatus(session))
    : aggregate.data as ReturnType<typeof summarizeSaleItems>;
  const sales = (recent.data || []) as FranchiseSale[];
  const items = sales.length ? await readAll<FranchiseSaleItem>((offset) => supabase.from("pos_sale_items")
    .select("sale_id,product_name_snapshot,category_snapshot,subcategory_snapshot,quantity,unit_price,line_total")
    .in("sale_id",sales.map(sale=>sale.id)).order("id").range(offset,offset+499)) : [];
  const transactions = buildManagerSalesReport({sales,items,customers:[],staff:[]},parseSalesReportFilters({month:period.from.slice(0,7)}),true).transactions;
  return { ...totals, transactions };
}
async function readCompatibleStoreItemTotals(
  supabase: Awaited<ReturnType<typeof requireFranchiseAdmin>>["supabase"],
  franchiseId: string,
  storeId: string,
  period: ReturnType<typeof reportPeriod>,
  saleStatus: "completed" | "voided" = "completed",
): Promise<ReturnType<typeof summarizeSaleItems>> {
  const categories = new Map<string, number>();
  const products = new Map<string, { key: string; name: string; quantity: number; cents: number }>();
  // Limit receipt IDs per item query and release each page after aggregation.
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase.from("pos_sales")
      .select("id,total,refunded_amount,stores!inner(franchise_id)")
      .eq("stores.franchise_id", franchiseId).eq("store_id", storeId).eq("status", saleStatus)
      .gte("created_at", period.start.toISOString()).lt("created_at", period.end.toISOString())
      .order("id").range(offset, offset + 99);
    if (error) throw new Error("Product totals could not be loaded. Please retry.");
    const sales = (data || []) as Pick<FranchiseSale, "id" | "total" | "refunded_amount">[];
    if (!sales.length) break;
    const items = await readAll<FranchiseSaleItem & { id: string }>(page => supabase.from("pos_sale_items")
      .select("id,sale_id,product_name_snapshot,category_snapshot,subcategory_snapshot,quantity,unit_price,line_total")
      .in("sale_id", sales.map(sale => sale.id)).order("id").range(page, page + 499));
    const grouped = new Map<string, typeof items>();
    for (const item of items) {
      const rows = grouped.get(item.sale_id) || [];
      rows.push(item); grouped.set(item.sale_id, rows);
    }
    for (const sale of sales) {
      const rows = grouped.get(sale.id) || [];
      const cents = allocateNetItemCents(sale, rows);
      rows.forEach((item, index) => {
        const category = item.category_snapshot?.trim() || "Uncategorized";
        const name = item.product_name_snapshot?.trim() || "Historical product";
        categories.set(category, (categories.get(category) || 0) + cents[index]);
        const key = JSON.stringify([category, name]);
        const product = products.get(key) || { key, name, quantity: 0, cents: 0 };
        product.quantity += Number(item.quantity); product.cents += cents[index];
        products.set(key, product);
      });
    }
    if (sales.length < 100) break;
  }
  return {
    categories: [...categories].sort(([a],[b]) => a.localeCompare(b)).map(([label, cents]) => ({ label, value: cents / 100 })),
    products: [...products.values()].sort((a,b) => b.cents-a.cents || a.key.localeCompare(b.key))
      .map(({ cents, ...product }) => ({ ...product, revenue: cents / 100 })),
  };
}
export async function getFranchiseReport(
  input: { from?: string; to?: string },
  storeId?: string,
) {
  await requireFranchiseAdmin();
  const longRange = input.from && input.to && Date.parse(input.to) - Date.parse(input.from) > 366 * 86400000;
  const period = longRange ? historicalReportingPeriod({ from: input.from!, to: input.to! }, await getFranchiseSalesHistory(storeId), new Date()) : reportPeriod(input),
    today = localDay(new Date());
  const earliest = new Date(
    Math.min(
      period.start.getTime(),
      Date.parse(`${today.slice(0, 4)}-01-01T00:00:00+02:00`),
      currentCalendarKpiBounds().week.start.getTime(),
    ),
  );
  const latest = new Date(
    Math.max(period.end.getTime(), Date.now() + 86400000),
  );
  const [directory, totals, details, historyStart] = await Promise.all([
    getFranchiseDirectory(storeId),
    getDashboardTotals(earliest, latest, storeId, true, period),
    storeId ? getStoreReportDetails(storeId, period) : Promise.resolve({categories:[],products:[],transactions:[]}),
    getFranchiseSalesHistory(storeId),
  ]);
  if (storeId && !directory.stores.some((s) => s.id === storeId))
    throw new Error("Store not found in your franchise.");
  const summary = summarizeDailyTotals(totals.daily, period);
  const scopedStores = storeId
    ? directory.stores.filter((s) => s.id === storeId)
    : directory.stores;
  const customerCounts = new Map(
    totals.customers.map((c) => [c.store_id, Number(c.count)]),
  );
  const performance = scopedStores.map((store) => {
    const rows = totals.daily.filter(
      (s) =>
        s.store_id === store.id && s.day >= period.from && s.day <= period.to,
    );
    return {
      store,
      managers: directory.staff.filter(
        (s) => s.store_id === store.id && s.role === "manager",
      ),
      revenue:
        rows.reduce((n, s) => n + Math.round(Number(s.revenue) * 100), 0) / 100,
      transactions: rows.reduce((n, row) => n + Number(row.transactions), 0),
      customers: customerCounts.get(store.id) || 0,
    };
  });
  return {
    ...directory,
    historyStart,
    period,
    snapshot: {
      daily: totals.daily,
      from: localDay(earliest),
      // Only advertise completely covered days. The legacy KPI query can end
      // partway through tomorrow, whereas custom controls request full days.
      to: localDay(new Date(latest.getTime() - 86400000)),
    },
    summary,
    performance,
    customers: [...customerCounts.values()].reduce((n, c) => n + c, 0),
    ...details,
  };
}
export const getFranchiseSalesHistory = cache(async (storeId?: string) => {
  if (storeId) await requireFranchiseStore(storeId);
  const { supabase, franchiseId, session } = await requireFranchiseAdmin();
  const stores = storeId ? [storeId] : (await readAll<{ id: string }>((offset) =>
    supabase.from("stores")
      .select("id")
      .eq("franchise_id", franchiseId)
      .order("id")
      .range(offset, offset + 499),
  )).map((store) => store.id);
  const before = new Date().toISOString();
  let firstSale: string | null = null;
  // The completed-sales index begins with store_id. A global oldest-sale sort
  // scans the franchise's sales under RLS; these indexed lookups stay small.
  for (let offset = 0; offset < stores.length; offset += 8) {
    const results = await Promise.all(stores.slice(offset, offset + 8).map((id) =>
      supabase.from("pos_sales")
        .select("created_at,stores!inner(franchise_id)")
        .eq("stores.franchise_id", franchiseId)
        .eq("store_id", id)
        .eq("status", showcaseSaleStatus(session))
        .lte("created_at", before)
        .order("created_at", { ascending: true })
        .limit(1),
    ));
    for (const { data, error } of results) {
      if (error) throw new Error("Sales history could not be loaded. Please retry.");
      const recorded = data?.[0]?.created_at;
      if (recorded && (!firstSale || Date.parse(recorded) < Date.parse(firstSale))) firstSale = recorded;
    }
  }
  return firstSale ? localDay(firstSale) : null;
});
export async function getFranchiseHistoricalSalesRange(input: { from: string; to: string }) {
  await requireFranchiseAdmin();
  const historyStart = await getFranchiseSalesHistory();
  const period = historicalReportingPeriod(input, historyStart, new Date());
  const totals = await getDashboardTotals(period.start, period.end, undefined, false, period);
  return { from: period.from, to: period.to, daily: totals.daily };
}
export async function getFranchiseSalesPeriod(input: {
  from: string;
  to: string;
}) {
  await requireFranchiseAdmin();
  if (
    !input ||
    typeof input.from !== "string" ||
    !input.from ||
    typeof input.to !== "string" ||
    !input.to
  )
    throw new Error("Choose both reporting dates.");
  const period = reportPeriod(input);
  const totals = await getDashboardTotals(
    period.start,
    period.end,
    undefined,
    false,
    period,
  );
  return { from: period.from, to: period.to, daily: totals.daily };
}
export async function getStoreRevenuePeriod(
  storeId: string,
  input: { from: string; to: string },
) {
  await requireFranchiseStore(storeId);
  if (!input?.from || !input?.to)
    throw new Error("Choose both reporting dates.");
  const period = Date.parse(input.to) - Date.parse(input.from) > 366 * 86400000
    ? historicalReportingPeriod(input, await getFranchiseSalesHistory(storeId), new Date()) : reportPeriod(input);
  const totals = await getDashboardTotals(
    period.start,
    period.end,
    storeId,
    false,
    period,
  );
  return { from: period.from, to: period.to, daily: totals.daily };
}
export async function getStoreDetailPeriod(
  storeId: string,
  input: { from: string; to: string },
) {
  await requireFranchiseStore(storeId);
  if (!input?.from || !input?.to) throw new Error("Choose both reporting dates.");
  const period = Date.parse(input.to)-Date.parse(input.from)>366*86400000
    ? historicalReportingPeriod(input,await getFranchiseSalesHistory(storeId),new Date()) : reportPeriod(input);
  const [snapshot,details] = await Promise.all([getStoreRevenuePeriod(storeId,input),getStoreReportDetails(storeId,period)]);
  return {from:period.from,to:period.to,...details,transactionCount:summarizeDailyTotals(snapshot.daily,period).transactionCount};
}
async function getDashboardTotals(
  start: Date,
  end: Date,
  storeId?: string,
  customers = true,
  selected?: { from: string; to: string },
): Promise<DashboardTotals> {
  const { supabase, franchiseId, session } = await requireFranchiseAdmin();
  const saleStatus = showcaseSaleStatus(session);
  return cachedFranchiseTotals(
    {
      userId: session.authUserId,
      franchiseId,
      storeId,
      from: selected?.from || start.toISOString(),
      to: selected?.to || end.toISOString(),
      calendarDay: localDay(new Date()),
      customers,
    },
    async () => {
      if (saleStatus === "voided") {
        const { data, error } = await supabase.rpc("franchise_dashboard_showcase_totals", {
          p_franchise_id: franchiseId,
          p_start: start.toISOString(),
          p_end: end.toISOString(),
          p_store_id: storeId || null,
          p_customers: customers,
        });
        if (error || !data)
          throw new Error("Showcase dashboard totals could not be loaded. Please retry.");
        return data as DashboardTotals;
      }
      const args = {
        p_franchise_id: franchiseId,
        p_start: start.toISOString(),
        p_end: end.toISOString(),
        p_store_id: storeId || null,
        p_customers: customers,
      };
      let { data, error } = await supabase.rpc("franchise_dashboard_totals_v3", args);
      if (error?.code === "PGRST202") {
        ({ data, error } = await supabase.rpc("franchise_dashboard_totals_v2", args));
      }
      // Older deployments have only the gross aggregate. Adjust its completed
      // refunded sales under the same tenant scope before falling back to rows.
      if (error?.code === "PGRST202") {
        const legacy = await readLegacyDashboardTotals(supabase, franchiseId, start, end, storeId, customers);
        if (legacy) return legacy;
        return readCompatibleDashboardTotals(supabase, franchiseId, start, end, storeId, customers);
      }
      if (error || !data)
        throw new Error("Dashboard totals could not be loaded. Please retry.");
      return data as DashboardTotals;
    },
  );
}
async function readLegacyDashboardTotals(
  supabase: Awaited<ReturnType<typeof requireFranchiseAdmin>>["supabase"],
  franchiseId: string,
  start: Date,
  end: Date,
  storeId: string | undefined,
  customers: boolean,
): Promise<DashboardTotals | null> {
  const { data, error } = await supabase.rpc("franchise_dashboard_totals", {
    p_franchise_id: franchiseId,
    p_start: start.toISOString(),
    p_end: end.toISOString(),
    p_store_id: storeId || null,
    p_customers: customers,
  });
  if (error?.code === "PGRST202") return null;
  if (error || !data) throw new Error("Dashboard totals could not be loaded. Please retry.");
  const refunded = await readAll<RefundedSale>((offset) => {
    let query = supabase.from("pos_sales")
      .select("store_id,created_at,total,refunded_amount,stores!inner(franchise_id)")
      .eq("stores.franchise_id", franchiseId)
      .eq("status", "completed")
      .gt("refunded_amount", 0)
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
      .order("id");
    if (storeId) query = query.eq("store_id", storeId);
    return query.range(offset, offset + 499);
  });
  return adjustLegacyTotals(data as DashboardTotals, refunded);
}
async function readCompatibleDashboardTotals(
  supabase: Awaited<ReturnType<typeof requireFranchiseAdmin>>["supabase"],
  franchiseId: string,
  start: Date,
  end: Date,
  storeId: string | undefined,
  customers: boolean,
  saleStatus: "completed" | "voided" = "completed",
): Promise<DashboardTotals> {
  if (storeId) await requireFranchiseStore(storeId);
  const daily = new Map<string, { store_id: string; day: string; cents: number; transactions: number }>();
  // Accumulate each page rather than retaining a full historical sales export.
  for (let offset = 0; ; offset += 500) {
    let query = supabase.from("pos_sales")
      .select("id,store_id,created_at,total,refunded_amount,stores!inner(franchise_id)")
      .eq("stores.franchise_id", franchiseId)
      .eq("status", saleStatus)
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
      .order("id");
    if (storeId) query = query.eq("store_id", storeId);
    const { data, error } = await query.range(offset, offset + 499);
    if (error) throw new Error("Dashboard totals could not be loaded. Please retry.");
    for (const sale of data || []) {
      const day = localDay(sale.created_at);
      const key = `${sale.store_id}:${day}`;
      const row = daily.get(key) || { store_id: sale.store_id, day, cents: 0, transactions: 0 };
      row.cents += netSaleCents(sale);
      row.transactions++;
      daily.set(key, row);
    }
    if (!data || data.length < 500) break;
  }
  const counts = new Map<string, number>();
  if (customers) {
    for (let offset = 0; ; offset += 500) {
      let query = supabase.from("pos_customers")
        .select("id,store_id,stores!inner(franchise_id)")
        .eq("stores.franchise_id", franchiseId)
        .is("deleted_at", null)
        .order("id");
      if (storeId) query = query.eq("store_id", storeId);
      const { data, error } = await query.range(offset, offset + 499);
      if (error) throw new Error("Dashboard totals could not be loaded. Please retry.");
      for (const customer of data || []) counts.set(customer.store_id, (counts.get(customer.store_id) || 0) + 1);
      if (!data || data.length < 500) break;
    }
  }
  return {
    daily: [...daily.values()].sort((a,b) => a.day.localeCompare(b.day) || a.store_id.localeCompare(b.store_id))
      .map(({ cents, ...row }) => ({ ...row, revenue: cents / 100 })),
    customers: [...counts].map(([store_id, count]) => ({ store_id, count })),
  };
}
export async function getFranchiseHome() {
  const { supabase, franchiseId } = await requireFranchiseAdmin();
  const start = new Date(`${localDay(new Date())}T00:00:00+02:00`);
  const [franchise, staff, logins, totals] = await Promise.all([
    supabase
      .from("franchises")
      .select(
        "id,name,registration_number,contact_email,phone,address,created_at",
      )
      .eq("id", franchiseId)
      .single<Franchise>(),
    readAll<FranchiseStaff>((o) =>
      supabase
        .from("staff_profiles")
        .select(
          "id,auth_user_id,full_name,email,role,account_status,stores!inner(franchise_id)",
        )
        .eq("stores.franchise_id", franchiseId)
        .eq("role", "manager")
        .neq("account_status", "deleted")
        .order("id")
        .range(o, o + 499),
    ),
    readAll<LoginRecord>((o) =>
      supabase
        .from("audit_logs")
        .select("user_id,details,stores!inner(franchise_id)")
        .eq("stores.franchise_id", franchiseId)
        .eq("action", "login_success")
        .gte("created_at", start.toISOString())
        .lt("created_at", new Date(start.getTime() + 86400000).toISOString())
        .contains("details", { role: "manager" })
        .order("id")
        .range(o, o + 499),
    ),
    getDashboardTotals(
      start,
      new Date(start.getTime() + 86400000),
      undefined,
      false,
    ),
  ]);
  if (franchise.error || !franchise.data)
    throw new Error("Franchise could not be loaded. Please retry.");
  const ids = new Set(
    logins.filter((l) => l.details?.role === "manager").map((l) => l.user_id),
  );
  return {
    session: (await requireFranchiseAdmin()).session,
    franchise: franchise.data,
    salesToday:
      totals.daily.reduce(
        (n, s) => n + Math.round(Number(s.revenue) * 100),
        0,
      ) / 100,
    loggedIn: staff.filter(
      (s) => s.role === "manager" && ids.has(s.auth_user_id),
    ),
    activeManagers: staff.filter(
      (s) => s.role === "manager" && s.account_status === "active",
    ).length,
  };
}
export async function getStoreLowStock(storeId: string) {
  const { supabase } = await requireFranchiseStore(storeId);
  type Row = {
    id: string;
    product_name: string;
    inventory_stock:
      | { current_quantity: number; low_stock_threshold: number }[]
      | { current_quantity: number; low_stock_threshold: number }
      | null;
  };
  const rows = await readAll<Row>((o) =>
    supabase
      .from("products")
      .select(
        "id,product_name,inventory_stock(current_quantity,low_stock_threshold)",
      )
      .eq("store_id", storeId)
      .eq("product_status", "active")
      .is("deleted_at", null)
      .order("id")
      .range(o, o + 499),
  );
  return rows
    .map((row) => {
      const stock = Array.isArray(row.inventory_stock)
        ? row.inventory_stock[0]
        : row.inventory_stock;
      return {
        id: row.id,
        name: row.product_name,
        quantity: Number(stock?.current_quantity || 0),
        threshold: Number(stock?.low_stock_threshold || 0),
      };
    })
    .filter((s) => inventoryStockLevel(s.quantity, s.threshold) !== "in_stock");
}
