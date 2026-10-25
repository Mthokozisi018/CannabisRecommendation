import "server-only";
import { requireActiveManager } from "@/lib/manager/auth";
import { requireAssignedStoreId } from "@/lib/store-scope";
import { monthBounds } from "@/lib/manager/report-calendar";
import { parseSupplyFilters, buildSupplyReport, type SupplyDelivery, type SupplyDirectoryEntry, type SupplyRecorder, type SupplyLine } from "@/lib/manager/supply-report-model";
export * from "@/lib/manager/supply-report-model";
const batchSize = 200;

export async function getManagerSupplyReport(input: unknown = {}) {
  const filters = parseSupplyFilters(input);
  const { supabase, profile } = await requireActiveManager();
  const storeId = requireAssignedStoreId(profile, "Manager");
  const bounds = monthBounds(filters.month);
  async function collect<T>(query: (offset: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
    const rows: T[] = [];
    for (let offset = 0; ; offset += batchSize) {
      const result = await query(offset);
      if (result.error) throw new Error("Supply history could not be loaded.");
      const batch = (result.data ?? []) as T[]; rows.push(...batch);
      if (batch.length < batchSize) return rows;
    }
  }
  const [deliveries, suppliers, recorderRows, staff] = await Promise.all([
    collect<SupplyDelivery>(offset => supabase.from("supply_deliveries").select("id,supplier_id,reference,created_at,received_at,recorded_by,total_cost").eq("store_id", storeId).gte("created_at", bounds.start.toISOString()).lt("created_at", bounds.end.toISOString()).order("created_at", { ascending: false }).order("id").range(offset, offset + batchSize - 1)),
    collect<SupplyDirectoryEntry>(offset => supabase.from("suppliers").select("id,name,status").eq("store_id", storeId).order("name").order("id").range(offset, offset + batchSize - 1)),
    collect<{ recorded_by: string | null }>(offset => supabase.from("supply_deliveries").select("recorded_by").eq("store_id", storeId).order("id").range(offset, offset + batchSize - 1)),
    collect<SupplyRecorder>(offset => supabase.from("staff_profiles").select("auth_user_id,user_id,full_name,first_name,surname,email,role").eq("store_id", storeId).order("id").range(offset, offset + batchSize - 1)),
  ]);
  const items: SupplyLine[] = [];
  for (let start = 0; start < deliveries.length; start += batchSize) {
    const ids = deliveries.slice(start, start + batchSize).map(delivery => delivery.id);
    items.push(...await collect<SupplyLine>(offset => supabase.from("supply_delivery_items").select("id,delivery_id,product_id,product_name_snapshot,category_snapshot,quantity,unit,unit_cost,line_total").eq("store_id", storeId).in("delivery_id", ids).order("id").range(offset, offset + batchSize - 1)));
  }
  return buildSupplyReport({ deliveries, items, suppliers, staff, recorderIds: recorderRows.map(row => row.recorded_by) }, filters);
}
