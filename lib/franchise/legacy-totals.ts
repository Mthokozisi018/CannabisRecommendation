import { localDay } from "./reporting";
import type { DashboardTotals } from "./totals-cache";

export type RefundedSale = {
  store_id: string;
  created_at: string;
  total: number | string;
  refunded_amount: number | string;
};

// The first aggregate RPC predates refunds. Correct only affected day/store
// buckets, using the same per-sale rounding as the net aggregate RPC.
export function adjustLegacyTotals(totals: DashboardTotals, refunded: RefundedSale[]): DashboardTotals {
  const adjustments = new Map<string, number>();
  for (const sale of refunded) {
    const key = `${sale.store_id}:${localDay(sale.created_at)}`;
    const cents = Math.round(Number(sale.total) * 100)
      - Math.round((Number(sale.total) - Number(sale.refunded_amount)) * 100);
    adjustments.set(key, (adjustments.get(key) || 0) + cents);
  }
  return {
    ...totals,
    daily: totals.daily.map((row) => ({
      ...row,
      revenue: (Math.round(Number(row.revenue) * 100)
        - (adjustments.get(`${row.store_id}:${row.day}`) || 0)) / 100,
    })),
  };
}
