import "server-only";

import type { DashboardSession } from "@/lib/dashboard-session";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const STORE_TIME_ZONE = "Africa/Johannesburg";
export const SALES_OVERVIEW_PAGE_SIZE = 25;

type SaleRow = {
  id: string;
  customer_id: string | null;
  staff_user_id: string | null;
  total: number | string;
  created_at: string;
};

type SaleItemRow = {
  id: string;
  sale_id: string;
  product_name_snapshot: string;
  category_snapshot: string | null;
  subcategory_snapshot: string | null;
  quantity: number;
  line_total: number | string;
};

type CustomerRow = {
  id: string;
  first_name: string;
  surname: string;
  phone_number: string;
};

type StaffRow = {
  auth_user_id: string;
  full_name: string | null;
  first_name: string | null;
  surname: string | null;
};

export type ManagerSalesOverviewRow = {
  id: string;
  saleId: string;
  createdAt: string;
  customerName: string;
  customerPhone: string | null;
  receptionistName: string;
  category: string;
  subcategory: string;
  productName: string;
  quantity: number;
  total: number;
};

export type ManagerSalesOverview = {
  totalCustomers: number;
  revenueThisWeek: number;
  salesToday: number;
  rows: ManagerSalesOverviewRow[];
  currentPage: number;
  totalPages: number;
  totalSales: number;
};

function datePartsInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second")
  };
}

function zonedDateTimeToUtc(parts: { year: number; month: number; day: number; hour?: number; minute?: number; second?: number }, timeZone: string) {
  const utcGuess = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour ?? 0, parts.minute ?? 0, parts.second ?? 0));
  const formatted = datePartsInTimeZone(utcGuess, timeZone);
  const formattedAsUtc = Date.UTC(formatted.year, formatted.month - 1, formatted.day, formatted.hour, formatted.minute, formatted.second);
  return new Date(utcGuess.getTime() - (formattedAsUtc - utcGuess.getTime()));
}

function businessPeriodBounds() {
  const now = new Date();
  const local = datePartsInTimeZone(now, STORE_TIME_ZONE);
  const todayStart = zonedDateTimeToUtc({ year: local.year, month: local.month, day: local.day }, STORE_TIME_ZONE);
  const tomorrowStart = zonedDateTimeToUtc({ year: local.year, month: local.month, day: local.day + 1 }, STORE_TIME_ZONE);
  const localDate = new Date(Date.UTC(local.year, local.month - 1, local.day));
  const mondayOffset = (localDate.getUTCDay() + 6) % 7;
  const weekStart = zonedDateTimeToUtc({ year: local.year, month: local.month, day: local.day - mondayOffset }, STORE_TIME_ZONE);
  return { weekStart, todayStart, tomorrowStart };
}

function numberValue(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function staffDisplayName(staff: StaffRow | undefined) {
  if (!staff) return "Staff member";
  return staff.full_name?.trim() || [staff.first_name, staff.surname].map((value) => value?.trim()).filter(Boolean).join(" ") || "Staff member";
}

export async function getManagerSalesOverview(session: DashboardSession, requestedPage = 1): Promise<ManagerSalesOverview> {
  const storeId = session.assignedStoreId;
  const admin = createSupabaseAdminClient();
  if (!storeId || !admin) {
    return { totalCustomers: 0, revenueThisWeek: 0, salesToday: 0, rows: [], currentPage: 1, totalPages: 1, totalSales: 0 };
  }

  const page = Math.max(1, Math.floor(requestedPage));
  const from = (page - 1) * SALES_OVERVIEW_PAGE_SIZE;
  const to = from + SALES_OVERVIEW_PAGE_SIZE - 1;
  const { weekStart, todayStart, tomorrowStart } = businessPeriodBounds();

  const [customerCountResult, weeklySalesResult, salesPageResult] = await Promise.all([
    admin
      .from("store_customer_registrations")
      .select("customer_id", { count: "exact", head: true })
      .eq("store_id", storeId),
    admin
      .from("pos_sales")
      .select("total, created_at")
      .eq("store_id", storeId)
      .eq("status", "completed")
      .gte("created_at", weekStart.toISOString())
      .lt("created_at", tomorrowStart.toISOString()),
    admin
      .from("pos_sales")
      .select("id, customer_id, staff_user_id, total, created_at", { count: "exact" })
      .eq("store_id", storeId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .range(from, to)
  ]);

  if (salesPageResult.error) throw new Error("Sales history could not be loaded.");

  const weeklySales = (weeklySalesResult.data ?? []) as Array<{ total: number | string; created_at: string }>;
  const revenueThisWeek = weeklySales.reduce((sum, sale) => sum + numberValue(sale.total), 0);
  const salesToday = weeklySales
    .filter((sale) => sale.created_at >= todayStart.toISOString() && sale.created_at < tomorrowStart.toISOString())
    .reduce((sum, sale) => sum + numberValue(sale.total), 0);

  const sales = (salesPageResult.data ?? []) as SaleRow[];
  const saleIds = sales.map((sale) => sale.id);
  const customerIds = Array.from(new Set(sales.map((sale) => sale.customer_id).filter((id): id is string => Boolean(id))));
  const staffIds = Array.from(new Set(sales.map((sale) => sale.staff_user_id).filter((id): id is string => Boolean(id))));

  const [itemsResult, customersResult, staffResult] = await Promise.all([
    saleIds.length
      ? admin
          .from("pos_sale_items")
          .select("id, sale_id, product_name_snapshot, category_snapshot, subcategory_snapshot, quantity, line_total")
          .in("sale_id", saleIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as SaleItemRow[], error: null }),
    customerIds.length
      ? admin.from("pos_customers").select("id, first_name, surname, phone_number").in("id", customerIds)
      : Promise.resolve({ data: [] as CustomerRow[], error: null }),
    staffIds.length
      ? admin.from("staff_profiles").select("auth_user_id, full_name, first_name, surname").in("auth_user_id", staffIds)
      : Promise.resolve({ data: [] as StaffRow[], error: null })
  ]);

  if (itemsResult.error || customersResult.error || staffResult.error) throw new Error("Sales details could not be loaded.");

  const items = (itemsResult.data ?? []) as SaleItemRow[];
  const customers = new Map(((customersResult.data ?? []) as CustomerRow[]).map((customer) => [customer.id, customer]));
  const staff = new Map(((staffResult.data ?? []) as StaffRow[]).map((member) => [member.auth_user_id, member]));
  const itemsBySale = new Map<string, SaleItemRow[]>();
  for (const item of items) {
    const existing = itemsBySale.get(item.sale_id) ?? [];
    existing.push(item);
    itemsBySale.set(item.sale_id, existing);
  }

  const rows: ManagerSalesOverviewRow[] = [];
  for (const sale of sales) {
    const customer = sale.customer_id ? customers.get(sale.customer_id) : undefined;
    const customerName = customer ? `${customer.first_name} ${customer.surname}`.trim() : "Customer not recorded";
    const receptionistName = sale.staff_user_id ? staffDisplayName(staff.get(sale.staff_user_id)) : "Staff member";
    const saleItems = itemsBySale.get(sale.id) ?? [];

    if (saleItems.length === 0) {
      rows.push({
        id: sale.id,
        saleId: sale.id,
        createdAt: sale.created_at,
        customerName,
        customerPhone: customer?.phone_number ?? null,
        receptionistName,
        category: "—",
        subcategory: "—",
        productName: "Sale record",
        quantity: 0,
        total: numberValue(sale.total)
      });
      continue;
    }

    for (const item of saleItems) {
      rows.push({
        id: item.id,
        saleId: sale.id,
        createdAt: sale.created_at,
        customerName,
        customerPhone: customer?.phone_number ?? null,
        receptionistName,
        category: item.category_snapshot || "—",
        subcategory: item.subcategory_snapshot || "—",
        productName: item.product_name_snapshot,
        quantity: item.quantity,
        total: numberValue(item.line_total)
      });
    }
  }

  const totalSales = salesPageResult.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalSales / SALES_OVERVIEW_PAGE_SIZE));

  return {
    totalCustomers: customerCountResult.count ?? 0,
    revenueThisWeek,
    salesToday,
    rows,
    currentPage: Math.min(page, totalPages),
    totalPages,
    totalSales
  };
}
