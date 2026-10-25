import type { SupplyHistoryEntry } from "./suppliers";

export const SUPPLY_TIME_ZONE = "Africa/Johannesburg";

export function supplyMonth(value: string | Date): string {
  const parts = new Intl.DateTimeFormat("en-ZA", { timeZone: SUPPLY_TIME_ZONE, year: "numeric", month: "2-digit" }).formatToParts(new Date(value));
  return `${parts.find((part) => part.type === "year")!.value}-${parts.find((part) => part.type === "month")!.value}`;
}

export type SupplyHistoryRow = {
  id: string; kind: "month" | "delivery"; period: string; supplierName: string;
  receivedAt: string; entries: SupplyHistoryEntry[]; supplies: number;
  quantities: { unit: SupplyHistoryEntry["unit"]; quantity: number }[]; totalCost: number;
};

// Group only for display. A null month lists original deliveries without monthly grouping.
export function groupSupplyHistory(history: SupplyHistoryEntry[], currentMonth: string | null): SupplyHistoryRow[] {
  const rows = new Map<string, SupplyHistoryRow>();
  for (const entry of [...history].sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt))) {
    const month = supplyMonth(entry.receivedAt);
    const kind = currentMonth !== null && month < currentMonth ? "month" : "delivery";
    const id = JSON.stringify([entry.supplierId, kind, kind === "month" ? month : entry.deliveryId]);
    let row = rows.get(id);
    if (!row) {
      row = { id, kind, period: month, supplierName: entry.supplierName, receivedAt: entry.receivedAt, entries: [], supplies: 0, quantities: [], totalCost: 0 };
      rows.set(id, row);
    }
    row.entries.push(entry);
    const quantity = row.quantities.find((item) => item.unit === entry.unit);
    if (quantity) quantity.quantity += entry.quantity;
    else row.quantities.push({ unit: entry.unit, quantity: entry.quantity });
    row.totalCost += Math.round(entry.lineTotal * 100);
  }
  return [...rows.values()].map((row) => ({ ...row, supplies: new Set(row.entries.map((entry) => entry.deliveryId)).size, totalCost: row.totalCost / 100 }));
}

export function supplyPeriodLabel(month: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: SUPPLY_TIME_ZONE, month: "long", year: "numeric" }).format(new Date(`${month}-01T12:00:00Z`));
}

export function supplyDate(value: string | Date): string {
  const parts = new Intl.DateTimeFormat("en-ZA", { timeZone: SUPPLY_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)!.value;
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(part("month")) - 1];
  return `${part("day")} ${month} ${part("year")}`;
}
