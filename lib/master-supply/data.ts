import "server-only";
import { requireFranchiseAdmin, requireFranchiseStore } from "@/lib/franchise/auth";
import { requireCompletedManagerDashboardSession } from "@/lib/manager/onboarding";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupplyDemoAccount, readSupplyDemoSnapshot } from "./demo-data";

export type MasterProduct = {
  id: string; franchise_id: string; sku: string; name: string; category: string;
  subcategory: string; strain_type: string | null; cultivation_type: string | null;
  price: number; image_url: string | null; description: string;
  on_hand: number; reserved: number; total_received: number;
  last_received_at: string | null; created_at: string;
};
export type SupplyStore = { id: string; name: string; city: string | null; province: string | null; store_image_url: string | null; is_active: boolean; store_access_status: string; physical_store_address?: string | null; postal_code?: string | null; store_phone_number?: string | null; store_contact_email?: string | null; created_at?: string };
export type SupplyRequest = {
  id: string; franchise_id: string; store_id: string; requested_by: string;
  status: string; notes: string; created_at: string; reviewed_at: string | null;
  master_supply_request_items: { product_id: string; requested_quantity: number; approved_quantity: number | null }[];
};
export type SupplyDistribution = {
  id: string; franchise_id: string; store_id: string; request_id: string | null;
  status: string; delivery_method: string; notes: string; distributed_by: string;
  received_by: string | null; dispatched_at: string | null; received_at: string | null; created_at: string;
  master_supply_distribution_items: { product_id: string; quantity: number; received_quantity: number | null }[];
};
export type StoreSourceStock = {
  store_id: string; franchise_id: string; master_product_id: string; product_id: string;
  quantity: number; received_total: number; sold_total: number;
};
export type SaleAllocation = {
  sale_item_id: string; sale_id: string; store_id: string; master_product_id: string; quantity: number; created_at: string; distribution_id?: string;
  pos_sale_items?: { quantity: number; line_total: number } | null;
  pos_sales: { status: string; refunded_amount: number; total: number } | null;
};
export type SupplyReceipt = { id: string; product_id: string; quantity: number; reason: string; created_at: string; actor_id: string };
export type SupplyRestock = { id: string; sale_item_id: string; quantity: number; created_at: string };
export type SupplyAdjustment = { id: string; product_id: string; delta: number; previous_quantity: number; new_quantity: number; reason: string; created_at: string };
export type SupplySnapshot = {
  franchiseId: string; storeId?: string; demo?: boolean;
  products: MasterProduct[]; stores: SupplyStore[]; requests: SupplyRequest[];
  distributions: SupplyDistribution[]; stocks: StoreSourceStock[];
  allocations: SaleAllocation[]; receipts: SupplyReceipt[]; restocks: SupplyRestock[]; adjustments: SupplyAdjustment[];
  names: Record<string, string>;
};

async function readAll<T>(makeQuery: (start: number, end: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await makeQuery(start, start + 999);
    if (error) throw new Error(`Master Supply data could not be loaded: ${error.message}`);
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < 1000) return rows;
  }
}

type SupplyView = "overview" | "inventory" | "distribute" | "history" | "requests" | "manager" | "store";
async function loadSnapshot(franchiseId: string, storeId?: string, view: SupplyView = "overview"): Promise<SupplySnapshot> {
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Master Supply database is unavailable.");
  const [products, stores, requests, distributions, stocks, allocations, receipts, restocks, adjustments] = await Promise.all([
    readAll<MasterProduct>((a,b) => client.from("master_supply_products").select("*").eq("franchise_id",franchiseId).order("name").range(a,b)),
    view === "inventory" ? Promise.resolve([] as SupplyStore[]) : readAll<SupplyStore>((a,b) => {
      let q=client.from("stores").select("id,name,city,province,store_image_url,is_active,store_access_status,physical_store_address,postal_code,store_phone_number,store_contact_email,created_at").eq("franchise_id",franchiseId).order("name").range(a,b);
      if(storeId && view==="store")q=q.eq("id",storeId);
      return q;
    }),
    view === "inventory" ? Promise.resolve([] as SupplyRequest[]) : readAll<SupplyRequest>((a,b) => {
      let q = client.from("master_supply_requests").select("*,master_supply_request_items(product_id,requested_quantity,approved_quantity)").eq("franchise_id",franchiseId).order("created_at",{ascending:false}).range(a,b);
      if (storeId) q = q.eq("store_id",storeId);
      return q;
    }),
    view === "inventory" || view === "distribute" ? Promise.resolve([] as SupplyDistribution[]) : readAll<SupplyDistribution>((a,b) => {
      let q = client.from("master_supply_distributions").select("*,master_supply_distribution_items(product_id,quantity,received_quantity)").eq("franchise_id",franchiseId).order("created_at",{ascending:false}).range(a,b);
      if (storeId) q = q.eq("store_id",storeId);
      return q;
    }),
    view === "overview" || view === "requests" || view === "manager" || view === "store" ? readAll<StoreSourceStock>((a,b) => {
      let q = client.from("master_supply_store_stock").select("*").eq("franchise_id",franchiseId).range(a,b);
      if (storeId) q = q.eq("store_id",storeId);
      return q;
    }) : Promise.resolve([] as StoreSourceStock[]),
    view === "overview" || view === "store" || view === "manager" ? readAll<SaleAllocation>((a,b) => {
      let q = client.from("master_supply_sale_allocations").select("sale_item_id,sale_id,store_id,master_product_id,quantity,created_at,pos_sales(status,refunded_amount,total),pos_sale_items(quantity,line_total)").eq("franchise_id",franchiseId).order("created_at",{ascending:false}).range(a,b);
      if (storeId) q = q.eq("store_id",storeId);
      return q;
    }) : Promise.resolve([] as SaleAllocation[]),
    view === "overview" || view === "inventory" ? readAll<SupplyReceipt>((a,b) => client.from("master_supply_receipts").select("id,product_id,quantity,reason,created_at,actor_id").eq("franchise_id",franchiseId).order("created_at",{ascending:false}).range(a,b)) : Promise.resolve([] as SupplyReceipt[]),
    view === "manager" ? readAll<SupplyRestock>((a,b) => client.from("master_supply_restocks").select("id,sale_item_id,quantity,created_at").eq("franchise_id",franchiseId).eq("store_id",storeId!).order("created_at",{ascending:false}).range(a,b)) : Promise.resolve([] as SupplyRestock[]),
    view === "inventory" ? readAll<SupplyAdjustment>((a,b) => client.from("master_supply_adjustments").select("id,product_id,delta,previous_quantity,new_quantity,reason,created_at").eq("franchise_id",franchiseId).order("created_at",{ascending:false}).range(a,b)) : Promise.resolve([] as SupplyAdjustment[])
  ]);
  const users = new Set<string>();
  requests.forEach(r => users.add(r.requested_by));
  distributions.forEach(d => { users.add(d.distributed_by); if (d.received_by) users.add(d.received_by); });
  const names: Record<string,string> = {};
  if (users.size) {
    const { data } = await client.from("staff_profiles").select("auth_user_id,full_name,email").in("auth_user_id",[...users]);
    for (const row of data ?? []) names[row.auth_user_id] = row.full_name || row.email || "Staff member";
  }
  return { franchiseId, storeId, products, stores, requests, distributions, stocks, allocations, receipts, restocks, adjustments, names };
}

export async function getFranchiseSupplySnapshot(view: Exclude<SupplyView,"manager"|"store"> = "overview") {
  const { franchiseId, session, supabase } = await requireFranchiseAdmin();
  if(isSupplyDemoAccount(session)) {
    const stores=await readAll<SupplyStore>((a,b)=>supabase.from("stores").select("id,name,city,province,store_image_url,is_active,store_access_status,physical_store_address,postal_code,store_phone_number,store_contact_email,created_at").eq("franchise_id",franchiseId).order("name").range(a,b));
    return readSupplyDemoSnapshot(session.authUserId,franchiseId,stores);
  }
  return loadSnapshot(franchiseId,undefined,view);
}

export async function getFranchiseStoreSupplySnapshot(storeId: string) {
  const { franchiseId, session, supabase } = await requireFranchiseStore(storeId);
  if(isSupplyDemoAccount(session)) {
    const stores=await readAll<SupplyStore>((a,b)=>supabase.from("stores").select("id,name,city,province,store_image_url,is_active,store_access_status,physical_store_address,postal_code,store_phone_number,store_contact_email,created_at").eq("franchise_id",franchiseId).order("name").range(a,b));
    const snapshot=await readSupplyDemoSnapshot(session.authUserId,franchiseId,stores);
    return {...snapshot,storeId,stores:snapshot.stores.filter(row=>row.id===storeId),requests:snapshot.requests.filter(row=>row.store_id===storeId),distributions:snapshot.distributions.filter(row=>row.store_id===storeId),stocks:snapshot.stocks.filter(row=>row.store_id===storeId),allocations:snapshot.allocations.filter(row=>row.store_id===storeId)};
  }
  return loadSnapshot(franchiseId,storeId,"store");
}

export async function getManagerSupplySnapshot() {
  const session = await requireCompletedManagerDashboardSession();
  const storeId = session.assignedStoreId;
  if (!storeId || session.profile.role !== "manager") throw new Error("Store manager access required.");
  const client = await createSupabaseServerClient();
  const { data, error } = await client!.from("stores").select("franchise_id").eq("id",storeId).maybeSingle();
  if (error || !data?.franchise_id) throw new Error("Master Supply is available to franchise stores only.");
  return loadSnapshot(data.franchise_id,storeId,"manager");
}
