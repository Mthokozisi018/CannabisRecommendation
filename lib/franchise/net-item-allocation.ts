import { netSaleCents } from "@/lib/sales-money";

// Same largest-remainder allocation as franchise_store_item_totals. BigInt
// keeps fractional shares exact until the final cent is assigned.
export function allocateNetItemCents(
  sale: Parameters<typeof netSaleCents>[0],
  items: { id: string; line_total: number | string }[],
): number[] {
  const net = BigInt(netSaleCents(sale));
  const weights = items.map(item => BigInt(Math.round(Number(item.line_total) * 100)));
  const weight = weights.reduce((sum, value) => sum + value, 0n);
  if (weight <= 0n) {
    const first = items.map((item, index) => ({ id: item.id, index }))
      .sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)[0]?.index;
    return items.map((_, index) => index === first ? Number(net) : 0);
  }
  const shares = weights.map((value, index) => {
    const numerator = net * value;
    // BigInt division truncates, whereas SQL floor rounds toward -infinity.
    const cents = numerator / weight - (numerator % weight < 0n ? 1n : 0n);
    return { index, cents, remainder: numerator - cents * weight };
  });
  const remainder = net - shares.reduce((sum, share) => sum + share.cents, 0n);
  const ranked = [...shares].sort((a,b) => a.remainder === b.remainder
    ? items[a.index].id < items[b.index].id ? -1 : items[a.index].id > items[b.index].id ? 1 : 0
    : a.remainder > b.remainder ? -1 : 1);
  for (let index = 0; index < Number(remainder); index++) ranked[index].cents++;
  return shares.map(share => Number(share.cents));
}
