/** Shared display/report arithmetic; database NUMERIC remains authoritative. */
export function netSaleCents(sale: {total: number | string | null; refunded_amount?: number | string | null}) {
  return Math.round(Number(sale.total) * 100) - Math.round(Number(sale.refunded_amount ?? 0) * 100);
}
export function sumNetSales(sales: {total: number | string | null; refunded_amount?: number | string | null}[]) {
  return sales.reduce((cents, sale) => cents + netSaleCents(sale), 0) / 100;
}
