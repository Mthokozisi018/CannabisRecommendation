import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { netSaleCents } from "@/lib/sales-money";

// Read through the caller's existing authorization context. This also supports
// databases whose older dashboard RPC still returns gross revenue.
export async function readStoreNetRevenue(client: Pick<SupabaseClient, "from">, storeId: string, start: Date, end: Date) {
  let cents = 0;
  const seen = new Set<string>();
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from("pos_sales").select("id,total,refunded_amount")
      .eq("store_id", storeId).eq("status", "completed")
      .gte("created_at", start.toISOString()).lt("created_at", end.toISOString())
      .order("id").range(offset, offset + 499);
    if (error) throw new Error("Net sales could not be loaded.");
    for (const sale of data || []) {
      if (seen.has(sale.id)) continue;
      seen.add(sale.id); cents += netSaleCents(sale);
    }
    if (!data || data.length < 500) break;
  }
  return cents / 100;
}
