import "server-only";
import { requireActiveManager } from "./auth";
import { requireAssignedStoreId } from "@/lib/store-scope";

export type AddStockSupplier = { id: string; name: string; categories: { category: string; subcategory: string }[] };

export async function listAddStockSuppliers(): Promise<AddStockSupplier[]> {
  const { supabase, profile } = await requireActiveManager();
  const storeId = requireAssignedStoreId(profile, "Manager");
  const [suppliers, mappings] = await Promise.all([
    supabase.from("suppliers").select("id,name").eq("store_id", storeId).eq("status", "active").order("name"),
    supabase.from("supplier_categories").select("supplier_id,category,subcategory").eq("store_id", storeId)
  ]);
  if (suppliers.error || mappings.error) throw new Error("Suppliers could not be loaded. Refresh and try again.");
  return (suppliers.data ?? []).map((supplier) => ({ ...supplier, categories: (mappings.data ?? []).filter((mapping) => mapping.supplier_id === supplier.id).map(({ category, subcategory }) => ({ category, subcategory })) }));
}
