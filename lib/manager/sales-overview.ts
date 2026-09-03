import "server-only";

import { z } from "zod";
import type { DashboardSession } from "@/lib/dashboard-session";
import { logServerEvent } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const SALES_TIME_ZONE = "Africa/Johannesburg";
export const SALES_PAGE_SIZE = 10;
const QUERY_BATCH_SIZE = 200;

export const salesReportFiltersSchema = z.object({
  month: z.string().trim().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  week: z.union([z.literal("all"), z.string().trim().regex(/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/)]).default("all"),
  search: z.string().trim().max(100).default(""),
  receptionist: z.string().trim().max(200).default("all"),
  category: z.string().trim().max(200).default("all"),
  page: z.coerce.number().int().min(1).max(10_000).default(1)
}).strict();

export type SalesReportFilters = z.infer<typeof salesReportFiltersSchema>;
export type ManagerSalesWeek = { value: string; label: string; startDate: string; endDate: string };
export type ManagerSalesItem = { product: string; category: string; subcategory: string; quantity: number; unitPrice: number; subtotal: number };
export type ManagerSalesTransaction = {
  saleId: string;
  receiptReference: string;
  createdAt: string;
  localDate: string;
  date: string;
  time: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  receptionistId: string | null;
  receptionistName: string;
  itemCount: number;
  recordedTotal: number;
  itemSubtotal: number;
  needsReconciliation: boolean;
  items: ManagerSalesItem[];
};
export type ManagerSalesSummary = { uniqueCustomers: number; revenue: number; transactionCount: number };
export type ManagerSalesKpis = {
  revenueThisWeek: number;
  revenueThisMonth: number;
  currentWeekLabel: string;
  currentMonthLabel: string;
};
export type ManagerSalesReport = {
  filters: SalesReportFilters;
  periodLabel: string;
  weeks: ManagerSalesWeek[];
  receptionistOptions: string[];
  categoryOptions: string[];
  summary: ManagerSalesSummary;
  kpis: ManagerSalesKpis;
  transactions: ManagerSalesTransaction[];
  totalTransactions: number;
  totalPages: number;
  emptyReason: "no-month-sales" | "no-week-sales" | "no-search-results" | null;
};

type SaleRow = { id: string; checkout_id: string | null; customer_id: string | null; staff_user_id: string | null; total: number | string | null; created_at: string };
type SaleItemRow = { sale_id: string; product_name_snapshot: string | null; category_snapshot: string | null; subcategory_snapshot: string | null; unit_price: number | string | null; quantity: number | string | null; line_total: number | string | null };
type CustomerRow = { id: string; first_name: string | null; surname: string | null; full_name: string | null; phone_display: string | null; phone_normalized: string | null };
type StaffRow = { auth_user_id: string | null; user_id: string | null; full_name: string | null; first_name: string | null; surname: string | null; email: string | null };
export type SalesReportSource = { sales: SaleRow[]; items: SaleItemRow[]; customers: CustomerRow[]; staff: StaffRow[] };

export class SalesOverviewSchemaError extends Error {
  constructor() {
    super("The local POS customer sales schema is unavailable. Apply the existing sales/customer schema before using Sales Overview.");
    this.name = "SalesOverviewSchemaError";
  }
}

const pad = (value: number) => String(value).padStart(2, "0");
function numberValue(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}
function datePartsInTimeZone(date: Date, timeZone = SALES_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute"), second: value("second") };
}
function zonedDateTimeToUtc(parts: { year: number; month: number; day: number }, timeZone = SALES_TIME_ZONE) {
  const guess = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const displayed = datePartsInTimeZone(guess, timeZone);
  const displayedAsUtc = Date.UTC(displayed.year, displayed.month - 1, displayed.day, displayed.hour, displayed.minute, displayed.second);
  return new Date(guess.getTime() - (displayedAsUtc - guess.getTime()));
}
export function currentJohannesburgMonth(now = new Date()) {
  const parts = datePartsInTimeZone(now);
  return `${parts.year}-${pad(parts.month)}`;
}
export function monthBounds(month: string) {
  const parsed = /^([0-9]{4})-([0-9]{2})$/.exec(month);
  if (!parsed) throw new Error("Invalid sales month.");
  const year = Number(parsed[1]);
  const monthNumber = Number(parsed[2]);
  return { start: zonedDateTimeToUtc({ year, month: monthNumber, day: 1 }), end: zonedDateTimeToUtc({ year, month: monthNumber + 1, day: 1 }) };
}
export function currentCalendarKpiBounds(now = new Date()) {
  const current = datePartsInTimeZone(now);
  const currentMonth = `${current.year}-${pad(current.month)}`;
  const weekday = new Date(Date.UTC(current.year, current.month - 1, current.day)).getUTCDay() || 7;
  const weekStartParts = { year: current.year, month: current.month, day: current.day - (weekday - 1) };
  const weekStart = zonedDateTimeToUtc(weekStartParts);
  const weekEnd = zonedDateTimeToUtc({ ...weekStartParts, day: weekStartParts.day + 7 });
  const displayDate = (date: Date) => new Intl.DateTimeFormat("en-ZA", { timeZone: SALES_TIME_ZONE, day: "2-digit", month: "short", year: "numeric" }).format(date);
  return {
    month: monthBounds(currentMonth),
    week: { start: weekStart, end: weekEnd },
    currentWeekLabel: `${displayDate(weekStart)} - ${displayDate(new Date(weekEnd.getTime() - 1))}`,
    currentMonthLabel: new Intl.DateTimeFormat("en-ZA", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${currentMonth}-01T00:00:00Z`))
  };
}
export function getMonthWeeks(month: string): ManagerSalesWeek[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const result: ManagerSalesWeek[] = [];
  let day = 1;
  while (day <= lastDay) {
    const startWeekday = new Date(Date.UTC(year, monthNumber - 1, day)).getUTCDay() || 7;
    const endDay = Math.min(lastDay, day + (7 - startWeekday));
    const startDate = `${month}-${pad(day)}`;
    const endDate = `${month}-${pad(endDay)}`;
    const format = (value: string) => new Intl.DateTimeFormat("en-ZA", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
    result.push({ value: startDate, startDate, endDate, label: `${format(startDate)} - ${format(endDate)}` });
    day = endDay + 1;
  }
  return result;
}
export function defaultSalesReportFilters(now = new Date()): SalesReportFilters {
  return { month: currentJohannesburgMonth(now), week: "all", search: "", receptionist: "all", category: "all", page: 1 };
}
export function parseSalesReportFilters(value: unknown, now = new Date()) {
  return salesReportFiltersSchema.parse({ ...defaultSalesReportFilters(now), ...(typeof value === "object" && value !== null ? value : {}) });
}
function localDate(value: string) {
  const parts = datePartsInTimeZone(new Date(value));
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}
function displayDateTime(value: string) {
  const date = new Date(value);
  return {
    date: new Intl.DateTimeFormat("en-ZA", { timeZone: SALES_TIME_ZONE, year: "numeric", month: "short", day: "2-digit" }).format(date),
    time: new Intl.DateTimeFormat("en-ZA", { timeZone: SALES_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date)
  };
}
function customerName(row: CustomerRow | undefined) {
  if (!row) return "Walk-in / historical sale";
  return row.full_name?.trim() || [row.first_name, row.surname].map((part) => part?.trim()).filter(Boolean).join(" ") || "Customer name unavailable";
}
function staffName(row: StaffRow | undefined, staffId: string | null) {
  if (!row) return staffId ? "Former staff member" : "Receptionist unavailable";
  return row.full_name?.trim() || [row.first_name, row.surname].map((part) => part?.trim()).filter(Boolean).join(" ") || row.email?.trim() || "Receptionist unavailable";
}
function compactReference(sale: SaleRow) {
  return sale.checkout_id?.trim() || `SALE-${sale.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export function buildManagerSalesReport(
  source: SalesReportSource,
  filters: SalesReportFilters,
  includeAll = false,
  calendarKpis?: { weekSales: SaleRow[]; monthSales: SaleRow[]; currentWeekLabel: string; currentMonthLabel: string }
): ManagerSalesReport {
  const weeks = getMonthWeeks(filters.month);
  const selectedWeek = filters.week === "all" ? null : weeks.find((week) => week.value === filters.week) ?? null;
  const customersById = new Map(source.customers.map((row) => [row.id, row]));
  const staffById = new Map<string, StaffRow>();
  source.staff.forEach((row) => {
    if (row.auth_user_id) staffById.set(row.auth_user_id, row);
    if (row.user_id) staffById.set(row.user_id, row);
  });
  const itemsBySale = new Map<string, SaleItemRow[]>();
  source.items.forEach((item) => itemsBySale.set(item.sale_id, [...(itemsBySale.get(item.sale_id) ?? []), item]));
  const monthTransactions = source.sales.map((sale): ManagerSalesTransaction => {
    const items = (itemsBySale.get(sale.id) ?? []).map((item) => ({
      product: item.product_name_snapshot?.trim() || "Historical product",
      category: item.category_snapshot?.trim() || "Uncategorized",
      subcategory: item.subcategory_snapshot?.trim() || "Unspecified",
      quantity: numberValue(item.quantity),
      unitPrice: numberValue(item.unit_price),
      subtotal: numberValue(item.line_total)
    }));
    const customer = sale.customer_id ? customersById.get(sale.customer_id) : undefined;
    const itemSubtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const recordedTotal = numberValue(sale.total);
    return {
      saleId: sale.id,
      receiptReference: compactReference(sale),
      createdAt: sale.created_at,
      localDate: localDate(sale.created_at),
      ...displayDateTime(sale.created_at),
      customerId: sale.customer_id,
      customerName: customerName(customer),
      customerPhone: customer?.phone_display?.trim() || customer?.phone_normalized?.trim() || "No cellphone on record",
      receptionistId: sale.staff_user_id,
      receptionistName: staffName(sale.staff_user_id ? staffById.get(sale.staff_user_id) : undefined, sale.staff_user_id),
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      recordedTotal,
      itemSubtotal,
      needsReconciliation: Math.abs(itemSubtotal - recordedTotal) >= 0.01,
      items
    };
  });
  const receptionistOptions = [...new Set(monthTransactions.map((transaction) => transaction.receptionistName))].sort((a, b) => a.localeCompare(b));
  const categoryOptions = [...new Set(monthTransactions.flatMap((transaction) => transaction.items.map((item) => item.category)))].sort((a, b) => a.localeCompare(b));
  const weekTransactions = selectedWeek ? monthTransactions.filter((transaction) => transaction.localDate >= selectedWeek.startDate && transaction.localDate <= selectedWeek.endDate) : monthTransactions;
  const query = filters.search.toLocaleLowerCase("en-ZA");
  const filtered = weekTransactions.filter((transaction) => {
    if (filters.receptionist !== "all" && transaction.receptionistName !== filters.receptionist) return false;
    if (filters.category !== "all" && !transaction.items.some((item) => item.category === filters.category)) return false;
    if (!query) return true;
    return [transaction.saleId, transaction.receiptReference, transaction.customerName, transaction.customerPhone, transaction.receptionistName, ...transaction.items.map((item) => item.product)]
      .some((value) => value.toLocaleLowerCase("en-ZA").includes(query));
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / SALES_PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);
  const normalizedFilters = { ...filters, week: selectedWeek?.value ?? "all", page };
  const transactions = includeAll ? filtered : filtered.slice((page - 1) * SALES_PAGE_SIZE, page * SALES_PAGE_SIZE);
  const periodLabel = selectedWeek?.label ?? new Intl.DateTimeFormat("en-ZA", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${filters.month}-01T00:00:00Z`));
  let emptyReason: ManagerSalesReport["emptyReason"] = null;
  if (monthTransactions.length === 0) emptyReason = "no-month-sales";
  else if (selectedWeek && weekTransactions.length === 0) emptyReason = "no-week-sales";
  else if (filtered.length === 0) emptyReason = "no-search-results";
  return {
    filters: normalizedFilters,
    periodLabel,
    weeks,
    receptionistOptions,
    categoryOptions,
    summary: {
      uniqueCustomers: new Set(filtered.map((transaction) => transaction.customerId).filter((id): id is string => Boolean(id))).size,
      revenue: filtered.reduce((sum, transaction) => sum + transaction.recordedTotal, 0),
      transactionCount: filtered.length
    },
    kpis: calendarKpis
      ? {
          revenueThisWeek: calendarKpis.weekSales.reduce((sum, sale) => sum + numberValue(sale.total), 0),
          revenueThisMonth: calendarKpis.monthSales.reduce((sum, sale) => sum + numberValue(sale.total), 0),
          currentWeekLabel: calendarKpis.currentWeekLabel,
          currentMonthLabel: calendarKpis.currentMonthLabel
        }
      : {
          revenueThisWeek: filtered.reduce((sum, transaction) => sum + transaction.recordedTotal, 0),
          revenueThisMonth: monthTransactions.reduce((sum, transaction) => sum + transaction.recordedTotal, 0),
          currentWeekLabel: periodLabel,
          currentMonthLabel: new Intl.DateTimeFormat("en-ZA", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${filters.month}-01T00:00:00Z`))
        },
    transactions,
    totalTransactions: filtered.length,
    totalPages,
    emptyReason
  };
}

function schemaMissing(message: string) {
  const lower = message.toLowerCase();
  return lower.includes("schema cache") || lower.includes("does not exist") || lower.includes("customer_id") || lower.includes("pos_customers");
}

export async function getManagerSalesReport(session: DashboardSession, input: unknown, options: { includeAll?: boolean } = {}): Promise<ManagerSalesReport> {
  const filters = parseSalesReportFilters(input);
  const storeId = session.assignedStoreId;
  if (!storeId) throw new Error("A manager store assignment is required.");
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Sales reporting is unavailable.");
  const authenticatedClient = supabase;
  const bounds = monthBounds(filters.month);
  const kpiBounds = currentCalendarKpiBounds();
  async function loadCompletedSalesWithin(range: { start: Date; end: Date }) {
    const rows: SaleRow[] = [];
    for (let offset = 0; ; offset += QUERY_BATCH_SIZE) {
      const result = await authenticatedClient.from("pos_sales").select("id, checkout_id, customer_id, staff_user_id, total, created_at").eq("store_id", storeId).eq("status", "completed").gte("created_at", range.start.toISOString()).lt("created_at", range.end.toISOString()).order("created_at", { ascending: false }).range(offset, offset + QUERY_BATCH_SIZE - 1);
      if (result.error) {
        if (schemaMissing(result.error.message)) throw new SalesOverviewSchemaError();
        throw new Error("Sales report data could not be loaded.");
      }
      const batch = (result.data ?? []) as SaleRow[];
      rows.push(...batch);
      if (batch.length < QUERY_BATCH_SIZE) break;
    }
    return rows;
  }
  const selectedSalesPromise = loadCompletedSalesWithin(bounds);
  const sameAsCurrentMonth = bounds.start.getTime() === kpiBounds.month.start.getTime() && bounds.end.getTime() === kpiBounds.month.end.getTime();
  const [sales, currentMonthSales, currentWeekSales] = await Promise.all([
    selectedSalesPromise,
    sameAsCurrentMonth ? selectedSalesPromise : loadCompletedSalesWithin(kpiBounds.month),
    loadCompletedSalesWithin(kpiBounds.week)
  ]);
  const items: SaleItemRow[] = [];
  const customers: CustomerRow[] = [];
  const staff: StaffRow[] = [];
  const saleIds = sales.map((sale) => sale.id);
  const customerIds = [...new Set(sales.map((sale) => sale.customer_id).filter((id): id is string => Boolean(id)))];
  const staffIds = [...new Set(sales.map((sale) => sale.staff_user_id).filter((id): id is string => Boolean(id)))];
  for (let index = 0; index < saleIds.length; index += QUERY_BATCH_SIZE) {
    const result = await supabase.from("pos_sale_items").select("sale_id, product_name_snapshot, category_snapshot, subcategory_snapshot, unit_price, quantity, line_total").in("sale_id", saleIds.slice(index, index + QUERY_BATCH_SIZE));
    if (result.error) {
      if (schemaMissing(result.error.message)) throw new SalesOverviewSchemaError();
      throw new Error("Sales report data could not be loaded.");
    }
    items.push(...((result.data ?? []) as SaleItemRow[]));
  }
  for (let index = 0; index < customerIds.length; index += QUERY_BATCH_SIZE) {
    const result = await supabase.from("pos_customers").select("id, first_name, surname, full_name, phone_display, phone_normalized").eq("store_id", storeId).in("id", customerIds.slice(index, index + QUERY_BATCH_SIZE)).is("deleted_at", null);
    if (result.error) {
      if (schemaMissing(result.error.message)) throw new SalesOverviewSchemaError();
      throw new Error("Sales report data could not be loaded.");
    }
    customers.push(...((result.data ?? []) as CustomerRow[]));
  }
  for (let index = 0; index < staffIds.length; index += QUERY_BATCH_SIZE) {
    const ids = staffIds.slice(index, index + QUERY_BATCH_SIZE);
    const [byAuth, byUser] = await Promise.all([
      supabase.from("staff_profiles").select("auth_user_id, user_id, full_name, first_name, surname, email").eq("store_id", storeId).in("auth_user_id", ids),
      supabase.from("staff_profiles").select("auth_user_id, user_id, full_name, first_name, surname, email").eq("store_id", storeId).in("user_id", ids)
    ]);
    if (byAuth.error || byUser.error) throw new Error("Sales report data could not be loaded.");
    const known = new Set(staff.flatMap((row) => [row.auth_user_id, row.user_id]).filter(Boolean));
    [...((byAuth.data ?? []) as StaffRow[]), ...((byUser.data ?? []) as StaffRow[])].forEach((row) => {
      const key = row.auth_user_id || row.user_id;
      if (key && !known.has(key)) { staff.push(row); known.add(key); }
    });
  }
  const report = buildManagerSalesReport({ sales, items, customers, staff }, filters, options.includeAll, {
    weekSales: currentWeekSales,
    monthSales: currentMonthSales,
    currentWeekLabel: kpiBounds.currentWeekLabel,
    currentMonthLabel: kpiBounds.currentMonthLabel
  });
  await Promise.all(report.transactions.filter((transaction) => transaction.needsReconciliation).map((transaction) => logServerEvent("warn", "manager_sales_total_reconciliation_required", { saleId: transaction.saleId })));
  return report;
}
