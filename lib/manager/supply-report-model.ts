
import { z } from "zod";


import { currentJohannesburgMonth, getMonthWeeks } from "@/lib/manager/report-calendar";
import { PRODUCT_CATEGORIES } from "@/lib/manager/options";
import { supplyDate, supplyMonth } from "@/lib/manager/supply-history";

export const SUPPLY_PAGE_SIZE = 10;

export const supplyFiltersSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), week: z.string().max(10).default("all"),
  recordedBy: z.string().max(200).default("all"), category: z.enum(["all", ...PRODUCT_CATEGORIES]).default("all"),
  supplier: z.string().max(200).default("all"), search: z.string().trim().max(100).default(""),
  page: z.coerce.number().int().min(1).max(10000).default(1),
}).strict();
export type SupplyFilters = z.infer<typeof supplyFiltersSchema>;
export type SupplyDirectoryEntry = { id: string; name: string; status: string };
export type SupplyDelivery = { id: string; supplier_id: string; reference: string; created_at: string; received_at: string; recorded_by: string | null; total_cost: number | string; notes?: string | null };
export type SupplyLine = { id: string; delivery_id: string; product_id: string; product_name_snapshot: string; category_snapshot: string; quantity: number | string; unit: "grams" | "units"; unit_cost: number | string; line_total: number | string };
export type SupplyRecorder = { auth_user_id: string | null; user_id: string | null; full_name: string | null; first_name: string | null; surname: string | null; email: string | null; role: string | null };
export type SupplyReportSource = { deliveries: SupplyDelivery[]; items: SupplyLine[]; suppliers: SupplyDirectoryEntry[]; staff: SupplyRecorder[]; recorderIds?: (string | null)[] };
export type SupplyTransaction = {
  id: string; supplierId: string; supplierName: string; recordedById: string | null; recordedBy: string;
  createdAt: string; receivedAt: string; dateTime: string; reference: string; notes: string | null;
  categories: string[]; items: SupplyLine[]; totalCost: number; itemSubtotal: number; needsReconciliation: boolean;
};
export type SupplyReport = {
  filters: SupplyFilters; weeks: ReturnType<typeof getMonthWeeks>; suppliers: SupplyDirectoryEntry[];
  recorders: { id: string; name: string }[]; transactions: SupplyTransaction[]; totalPages: number;
  summary: { transactions: number; suppliers: number; uniqueProducts: number; quantities: { unit: "grams" | "units"; quantity: number }[]; totalCost: number };
  emptyReason: "month" | "week" | "filters" | null;
};
export function parseSupplyFilters(input: unknown = {}, now = new Date()): SupplyFilters {
  const filters = supplyFiltersSchema.parse({ month: currentJohannesburgMonth(now), ...(typeof input === "object" && input !== null ? input : {}) });
  if (filters.week !== "all" && !getMonthWeeks(filters.month).some(week => week.value === filters.week)) throw new Error("Invalid supply week.");
  return filters;
}
function recorderName(staff: SupplyRecorder | undefined, id: string | null) {
  return staff?.full_name?.trim() || [staff?.first_name, staff?.surname].filter(Boolean).join(" ") || staff?.email || (id ? "Former staff member" : "Recorded by unavailable");
}
export function buildSupplyReport(source: SupplyReportSource, filters: SupplyFilters): SupplyReport {
  const weeks = getMonthWeeks(filters.month);
  const selectedWeek = weeks.find(week => week.value === filters.week);
  const suppliers = new Map(source.suppliers.map(supplier => [supplier.id, supplier]));
  const staff = new Map<string, SupplyRecorder>();
  source.staff.forEach(person => { if (person.auth_user_id) staff.set(person.auth_user_id, person); if (person.user_id) staff.set(person.user_id, person); });
  const items = new Map<string, SupplyLine[]>();
  for (const item of new Map(source.items.map(item => [item.id, item])).values()) items.set(item.delivery_id, [...(items.get(item.delivery_id) ?? []), item]);
  const monthTransactions = [...new Map(source.deliveries.map(delivery => [delivery.id, delivery])).values()]
    .filter(delivery => supplyMonth(delivery.created_at) === filters.month).map((delivery): SupplyTransaction => {
      const lines = items.get(delivery.id) ?? [];
      const subtotal = lines.reduce((cents, line) => cents + Math.round(Number(line.line_total) * 100), 0) / 100;
      return {
        id: delivery.id, supplierId: delivery.supplier_id, supplierName: suppliers.get(delivery.supplier_id)?.name ?? "Supplier name unavailable",
        recordedById: delivery.recorded_by, recordedBy: recorderName(delivery.recorded_by ? staff.get(delivery.recorded_by) : undefined, delivery.recorded_by),
        createdAt: delivery.created_at, receivedAt: delivery.received_at,
        dateTime: `${supplyDate(delivery.created_at)}, ${new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(delivery.created_at))}`,
        reference: delivery.reference, notes: delivery.notes ?? null, categories: [...new Set(lines.map(line => line.category_snapshot))], items: lines,
        totalCost: Number(delivery.total_cost), itemSubtotal: subtotal,
        needsReconciliation: Math.round(subtotal * 100) !== Math.round(Number(delivery.total_cost) * 100) || lines.some(line => Number(line.quantity) * Math.round(Number(line.unit_cost) * 100) !== Math.round(Number(line.line_total) * 100)),
      };
    }).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id));
  const weekTransactions = monthTransactions.filter(transaction => !selectedWeek || (() => {
      const day = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "2-digit" }).format(new Date(transaction.createdAt));
      const localDay = `${supplyMonth(transaction.createdAt)}-${day}`;
    return localDay >= selectedWeek.startDate && localDay <= selectedWeek.endDate;
  })());
  const needle = filters.search.toLocaleLowerCase();
  const filtered = weekTransactions.filter(transaction =>
    (filters.recordedBy === "all" || (transaction.recordedById ?? "unavailable") === filters.recordedBy) &&
    (filters.supplier === "all" || transaction.supplierId === filters.supplier) &&
    (filters.category === "all" || transaction.categories.includes(filters.category)) &&
    (!needle || [transaction.supplierName, transaction.recordedBy, transaction.reference, ...transaction.items.map(item => item.product_name_snapshot)].join(" ").toLocaleLowerCase().includes(needle)));
  const quantities = new Map<"grams" | "units", number>();
  filtered.forEach(transaction => transaction.items.forEach(item => quantities.set(item.unit, (quantities.get(item.unit) ?? 0) + Number(item.quantity))));
  const totalPages = Math.max(1, Math.ceil(filtered.length / SUPPLY_PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);
  const recorders = [...new Set(source.recorderIds ?? source.deliveries.map(delivery => delivery.recorded_by))].map(id => {
    const person = id ? staff.get(id) : undefined;
    const name = recorderName(person, id);
    return { id: id ?? "unavailable", name: person?.role && person.role !== "manager" ? `${name} (${person.role})` : name === "Former staff member" ? `${name} (${id!.slice(0, 8)})` : name };
  }).sort((a, b) => a.name.localeCompare(b.name));
  return {
    filters: { ...filters, page }, weeks, suppliers: source.suppliers, recorders,
    transactions: filtered.slice((page - 1) * SUPPLY_PAGE_SIZE, page * SUPPLY_PAGE_SIZE), totalPages,
    summary: { transactions: filtered.length, suppliers: new Set(filtered.map(transaction => transaction.supplierId)).size,
      uniqueProducts: new Set(filtered.flatMap(transaction => transaction.items.map(item => item.product_id))).size,
      quantities: [...quantities].map(([unit, quantity]) => ({ unit, quantity })), totalCost: filtered.reduce((cents, transaction) => cents + Math.round(transaction.totalCost * 100), 0) / 100 },
    emptyReason: filtered.length ? null : !monthTransactions.length ? "month" : !weekTransactions.length ? "week" : "filters",
  };
}

