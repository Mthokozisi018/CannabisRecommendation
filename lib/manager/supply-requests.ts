import "server-only";
import { cache } from "react";
import { requireCompletedManagerDashboardSession } from "@/lib/manager/onboarding";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import type { CatalogueProduct, ManagerSupplyContext, ManagerSupplyRequestsData } from "./supply-request-model";
import type { SaleAllocation, StoreSourceStock, SupplyRestock } from "@/lib/master-supply/data";

export const getManagerSupplyContext = cache(async (): Promise<ManagerSupplyContext | null> => {
  const session = await requireCompletedManagerDashboardSession();
  if (session.profile.role !== "manager" || !session.assignedStoreId) return null;
  const client = await createSupabaseServerClient();
  if (!client) return null;
  const { data, error } = await client.rpc("manager_supply_context");
  if (error?.code === "PGRST202") {
    const admin = createSupabaseAdminClient();
    if (!admin) return null;
    const { data: store, error: storeError } = await admin.from("stores")
      .select("id,name,franchise_id").eq("id", session.assignedStoreId)
      .eq("is_active", true).eq("store_access_status", "active").maybeSingle();
    if (storeError || !store?.franchise_id) return null;
    const { data: administrator, error: administratorError } = await admin.from("staff_profiles")
      .select("id").eq("franchise_id", store.franchise_id).eq("role", "franchise_admin")
      .eq("is_active", true).eq("account_status", "active").eq("account_setup_complete", true).limit(1).maybeSingle();
    if (administratorError || !administrator) return null;
    const { data: franchise, error: franchiseError } = await admin.from("franchises")
      .select("id,name").eq("id", store.franchise_id).maybeSingle();
    if (franchiseError || !franchise) return null;
    return { store_id: store.id, store_name: store.name, franchise_id: franchise.id, franchise_name: franchise.name };
  }
  const row = data?.[0] as ManagerSupplyContext | undefined;
  if (error || !row || row.store_id !== session.assignedStoreId || !row.franchise_id) return null;
  return { store_id: row.store_id, store_name: row.store_name, franchise_id: row.franchise_id, franchise_name: row.franchise_name };
});

export async function requireManagerSupplyContext() {
  const context = await getManagerSupplyContext();
  if (!context) throw new Error("Supply requests are available only to verified franchise store managers.");
  return context;
}

async function allRows<T>(query: (start: number, end: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await query(start, start + 999);
    if (error) throw new Error("Your store's supply information could not be loaded. Please retry.");
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < 1000) return rows;
  }
}

export async function getManagerSupplyRequests(): Promise<ManagerSupplyRequestsData> {
  const context = await requireManagerSupplyContext();
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supply requests are temporarily unavailable.");
  const catalogueProbe = await client.rpc("manager_supply_catalogue").range(0, 999);
  const legacyCatalogue = catalogueProbe.error?.code === "PGRST202";
  if (catalogueProbe.error && !legacyCatalogue) throw new Error("Your store's supply information could not be loaded. Please retry.");
  const admin = legacyCatalogue ? createSupabaseAdminClient() : null;
  if (legacyCatalogue && !admin) throw new Error("Supply requests are temporarily unavailable.");
  const productsPromise = legacyCatalogue
    ? allRows<CatalogueProduct & { on_hand: number; reserved: number }>((a,b) => admin!.from("master_supply_products")
        .select("id,sku,name,category,subcategory,strain_type,cultivation_type,image_url,on_hand,reserved")
        .eq("franchise_id", context.franchise_id).order("name").order("id").range(a,b))
    : Promise.resolve((catalogueProbe.data ?? []) as CatalogueProduct[]).then(async first => first.length < 1000 ? first : [
        ...first,
        ...await allRows<CatalogueProduct>((a,b) => client.rpc("manager_supply_catalogue").range(a+1000,b+1000))
      ]);
  const [products, requests, distributions] = await Promise.all([
    productsPromise,
    allRows<ManagerSupplyRequestsData["requests"][number]>((a,b) => client.from("master_supply_requests")
      .select(legacyCatalogue
        ? "id,franchise_id,store_id,requested_by,status,notes,created_at,reviewed_at,master_supply_request_items(product_id,requested_quantity,approved_quantity)"
        : "id,franchise_id,store_id,requested_by,status,notes,rejection_reason,created_at,reviewed_at,master_supply_request_items(product_id,requested_quantity,approved_quantity)")
      .eq("franchise_id", context.franchise_id).eq("store_id", context.store_id).order("created_at", { ascending: false }).order("id").range(a,b)),
    allRows<ManagerSupplyRequestsData["distributions"][number]>((a,b) => client.from("master_supply_distributions")
      .select("id,franchise_id,store_id,request_id,status,delivery_method,notes,distributed_by,received_by,dispatched_at,received_at,created_at,master_supply_distribution_items(product_id,quantity,received_quantity)")
      .eq("franchise_id", context.franchise_id).eq("store_id", context.store_id).order("created_at", { ascending: false }).order("id").range(a,b)),
  ]);
  // Explicit DTO whitelist: even accidental extra RPC fields never reach RSC props.
  return { context, products: products.map(p => ({ id:p.id, sku:p.sku, name:p.name, category:p.category, subcategory:p.subcategory,
    strain_type:p.strain_type, cultivation_type:p.cultivation_type, image_url:p.image_url,
    available: legacyCatalogue ? "on_hand" in p && "reserved" in p && typeof p.on_hand === "number" && typeof p.reserved === "number" && p.on_hand > p.reserved : p.available === true })),
    requests: legacyCatalogue ? requests.map(request => ({ ...request, rejection_reason: "" })) : requests, distributions };
}

export async function getManagerSupplyDeliveries() {
  const data = await getManagerSupplyRequests();
  const client = (await createSupabaseServerClient())!;
  const { franchise_id: franchiseId, store_id: storeId } = data.context;
  const [stocks, allocations, restocks] = await Promise.all([
    allRows<StoreSourceStock>((a,b) => client.from("master_supply_store_stock").select("store_id,franchise_id,master_product_id,product_id,quantity,received_total,sold_total").eq("franchise_id",franchiseId).eq("store_id",storeId).range(a,b)),
    allRows<SaleAllocation>((a,b) => client.from("master_supply_sale_allocations").select("sale_item_id,sale_id,store_id,master_product_id,quantity,created_at,pos_sales(status,refunded_amount,total),pos_sale_items(quantity,line_total)").eq("franchise_id",franchiseId).eq("store_id",storeId).range(a,b)),
    allRows<SupplyRestock>((a,b) => client.from("master_supply_restocks").select("id,sale_item_id,quantity,created_at").eq("franchise_id",franchiseId).eq("store_id",storeId).range(a,b)),
  ]);
  return { ...data, stocks, allocations, restocks };
}
export type ManagerSupplyDeliveries = Awaited<ReturnType<typeof getManagerSupplyDeliveries>>;
