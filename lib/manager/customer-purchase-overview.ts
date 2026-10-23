import "server-only";
import { z } from "zod";
import type { DashboardSession } from "@/lib/dashboard-session";
import { netSaleCents } from "@/lib/sales-money";
import { getManagerSalesReport, salesReportFiltersSchema, type ManagerSalesTransaction } from "@/lib/manager/sales-overview";
import { datePartsInTimeZone, getMonthWeeks, monthBounds, pad } from "@/lib/manager/report-calendar";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const CUSTOMER_PURCHASE_PAGE_SIZE = 20;
export const customerPurchaseOverviewInputSchema = z.object({
  filters: salesReportFiltersSchema,
  search: z.string().trim().max(100).default(""),
  sort: z.enum(["purchases_desc", "purchases_asc", "spent_desc", "spent_asc"]).default("purchases_desc"),
  page: z.number().int().min(1).max(10_000).default(1)
}).strict();

export type CustomerPurchaseOverviewInput = z.infer<typeof customerPurchaseOverviewInputSchema>;
export type CustomerPurchaseRow = {
  customerId: string;
  name: string;
  surname: string;
  phoneNumber: string;
  timesPurchased: number;
  totalSpent: number;
};
export type CustomerPurchaseOverview = {
  rows: CustomerPurchaseRow[];
  totalCustomers: number;
  matchingCustomers: number;
  page: number;
  totalPages: number;
};

type CustomerPurchaseTransaction = Pick<ManagerSalesTransaction, "saleId" | "customerId" | "customerFirstName" | "customerSurname" | "customerName" | "customerPhone" | "recordedTotal" | "refundedAmount">;

export function buildCustomerPurchaseOverview(transactions: CustomerPurchaseTransaction[], input: Pick<CustomerPurchaseOverviewInput, "search" | "sort" | "page">): CustomerPurchaseOverview {
  const byCustomer = new Map<string, CustomerPurchaseRow>();
  const seenSales = new Set<string>();
  for (const sale of transactions) {
    if (!sale.customerId || seenSales.has(sale.saleId)) continue;
    seenSales.add(sale.saleId);
    const netCents = netSaleCents({ total: sale.recordedTotal, refunded_amount: sale.refundedAmount });
    if (netCents <= 0) continue;
    const row = byCustomer.get(sale.customerId) ?? {
      customerId: sale.customerId,
      name: sale.customerFirstName || sale.customerName.split(/\s+/)[0] || "—",
      surname: sale.customerSurname || "—",
      phoneNumber: sale.customerPhone === "No cellphone on record" ? "—" : sale.customerPhone,
      timesPurchased: 0,
      totalSpent: 0
    };
    row.timesPurchased += 1;
    row.totalSpent += netCents;
    byCustomer.set(sale.customerId, row);
  }

  const query = input.search.toLocaleLowerCase("en-ZA");
  const digits = input.search.replace(/\D/g, "");
  const matching = [...byCustomer.values()].filter((row) => !query ||
    [row.name, row.surname, `${row.name} ${row.surname}`, row.phoneNumber]
      .some((value) => value.toLocaleLowerCase("en-ZA").includes(query)) ||
    (digits.length > 0 && row.phoneNumber.replace(/\D/g, "").includes(digits)));
  matching.sort((a, b) => {
    const amount = input.sort.startsWith("purchases")
      ? a.timesPurchased - b.timesPurchased : a.totalSpent - b.totalSpent;
    return (input.sort.endsWith("desc") ? -amount : amount) ||
      a.surname.localeCompare(b.surname) || a.name.localeCompare(b.name) || a.customerId.localeCompare(b.customerId);
  });
  const totalPages = Math.max(1, Math.ceil(matching.length / CUSTOMER_PURCHASE_PAGE_SIZE));
  const page = Math.min(input.page, totalPages);
  return {
    rows: matching.slice((page - 1) * CUSTOMER_PURCHASE_PAGE_SIZE, page * CUSTOMER_PURCHASE_PAGE_SIZE)
      .map((row) => ({ ...row, totalSpent: row.totalSpent / 100 })),
    totalCustomers: byCustomer.size,
    matchingCustomers: matching.length,
    page,
    totalPages
  };
}

async function loadCustomerPurchasesWithoutReportFilters(session: DashboardSession, month: string, week: string): Promise<CustomerPurchaseTransaction[]> {
  const storeId = session.assignedStoreId;
  if (!storeId) throw new Error("A manager store assignment is required.");
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Customer purchases are unavailable.");
  const bounds = monthBounds(month);
  const selectedWeek = week === "all" ? null : getMonthWeeks(month).find((entry) => entry.value === week);
  const sales: Array<{ id: string; customer_id: string; total: number | string | null; refunded_amount: number | string | null; created_at: string }> = [];
  const batchSize = 1000;
  for (let offset = 0; ; offset += batchSize) {
    const { data, error } = await supabase.from("pos_sales")
      .select("id,customer_id,total,refunded_amount,created_at")
      .eq("store_id", storeId).eq("status", "completed")
      .not("customer_id", "is", null)
      .gte("created_at", bounds.start.toISOString()).lt("created_at", bounds.end.toISOString())
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .range(offset, offset + batchSize - 1);
    if (error) throw new Error("Customer purchases could not be loaded.");
    sales.push(...(data ?? []) as typeof sales);
    if ((data?.length ?? 0) < batchSize) break;
  }
  const selectedSales = selectedWeek ? sales.filter((sale) => {
    const date = datePartsInTimeZone(new Date(sale.created_at));
    const localDate = `${date.year}-${pad(date.month)}-${pad(date.day)}`;
    return localDate >= selectedWeek.startDate && localDate <= selectedWeek.endDate;
  }) : sales;
  const qualifyingSales = selectedSales.filter((sale) => netSaleCents({ total: sale.total, refunded_amount: sale.refunded_amount }) > 0);
  const customerIds = [...new Set(qualifyingSales.map((sale) => sale.customer_id))];
  const customerBatches = await Promise.all(Array.from({ length: Math.ceil(customerIds.length / 200) }, async (_, index) => {
    const { data, error } = await supabase.from("pos_customers")
      .select("id,first_name,surname,full_name,phone_display,phone_normalized")
      .eq("store_id", storeId).in("id", customerIds.slice(index * 200, (index + 1) * 200))
      .is("deleted_at", null);
    if (error) throw new Error("Customer purchases could not be loaded.");
    return data ?? [];
  }));
  const customers = new Map(customerBatches.flat().map((customer) => [customer.id, customer]));
  return qualifyingSales.flatMap((sale) => {
    const customer = customers.get(sale.customer_id);
    if (!customer) return [];
    const name = customer.full_name?.trim() || [customer.first_name, customer.surname].map((part) => part?.trim()).filter(Boolean).join(" ") || "Customer name unavailable";
    return [{
      saleId: sale.id, customerId: sale.customer_id,
      customerFirstName: customer.first_name?.trim() || "",
      customerSurname: customer.surname?.trim() || "",
      customerName: name,
      customerPhone: customer.phone_display?.trim() || customer.phone_normalized?.trim() || "No cellphone on record",
      recordedTotal: Number(sale.total ?? 0), refundedAmount: Number(sale.refunded_amount ?? 0)
    }];
  });
}

export async function getManagerCustomerPurchaseOverview(session: DashboardSession, input: unknown) {
  const parsed = customerPurchaseOverviewInputSchema.parse(input);
  if (parsed.filters.receptionist === "all" && parsed.filters.category === "all" && !parsed.filters.search) {
    const transactions = await loadCustomerPurchasesWithoutReportFilters(session, parsed.filters.month, parsed.filters.week);
    return buildCustomerPurchaseOverview(transactions, parsed);
  }
  const report = await getManagerSalesReport(session, { ...parsed.filters, page: 1 }, { includeAll: true, skipCalendarKpis: true });
  return buildCustomerPurchaseOverview(report.transactions, parsed);
}
