import "server-only";
import { requireActiveManager } from "./auth";
import { requireAssignedStoreId } from "@/lib/store-scope";

export type AddStockSupplier = { id: string; name: string; categories: { category: string; subcategory: string }[] };

export async function listAddStockSuppliers(): Promise<AddStockSupplier[]> {
  const { supabase, profile } = await requireActiveManager();
  const storeId = requireAssignedStoreId(profile, "Manager");
  const { data, error } = await supabase.from("suppliers").select("id,name").eq("store_id", storeId).eq("status", "active").order("name");
  if (error) throw new Error("Suppliers could not be loaded. Refresh and try again.");
  return (data ?? []).map((supplier) => ({ ...supplier, categories: [] }));
}
