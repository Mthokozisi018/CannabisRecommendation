import "server-only";
import type { DashboardSession } from "@/lib/dashboard-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ManagerStoreSettings = {
  name: string;
  publicDescription: string;
  contactEmail: string;
  phoneNumber: string;
  physicalAddress: string;
  city: string;
  province: string;
  postalCode: string;
  openingHours: Record<string, unknown>;
  fulfillment: {
    ordersEnabled: boolean;
    collectionEnabled: boolean;
    deliveryEnabled: boolean;
    collectionLeadMinutes: number;
    collectionMinimum: number;
    collectionFee: number;
    deliveryMinimum: number;
    deliveryFee: number;
    deliveryEtaMinMinutes: number | null;
    deliveryEtaMaxMinutes: number | null;
    deliveryRadiusKm: number | null;
  };
};

type StoreRow = {
  id: string;
  name: string;
  public_description: string | null;
  store_contact_email: string | null;
  store_phone_number: string | null;
  address: string | null;
  store_address: string | null;
  physical_store_address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  opening_hours: Record<string, unknown> | null;
};

type FulfillmentRow = {
  store_id: string;
  orders_enabled: boolean;
  collection_enabled: boolean;
  delivery_enabled: boolean;
  collection_lead_minutes: number;
  collection_minimum: number | string;
  collection_fee: number | string;
  delivery_minimum: number | string;
  delivery_fee: number | string;
  delivery_eta_min_minutes: number | null;
  delivery_eta_max_minutes: number | null;
  delivery_radius_km: number | string | null;
};

export async function getOwnManagerStoreSettings(session: DashboardSession): Promise<ManagerStoreSettings> {
  if (!session.isManager || !session.assignedStoreId) throw new Error("An assigned manager store is required.");
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Store settings are unavailable.");

  const [storeResult, fulfillmentResult] = await Promise.all([
    supabase.from("stores")
      .select("id,name,public_description,store_contact_email,store_phone_number,address,store_address,physical_store_address,city,province,postal_code,opening_hours")
      .eq("id", session.assignedStoreId)
      .maybeSingle<StoreRow>(),
    supabase.from("store_fulfillment_settings")
      .select("store_id,orders_enabled,collection_enabled,delivery_enabled,collection_lead_minutes,collection_minimum,collection_fee,delivery_minimum,delivery_fee,delivery_eta_min_minutes,delivery_eta_max_minutes,delivery_radius_km")
      .eq("store_id", session.assignedStoreId)
      .maybeSingle<FulfillmentRow>()
  ]);

  if (storeResult.error || storeResult.data?.id !== session.assignedStoreId) throw new Error("Your manager store could not be loaded.");
  if (fulfillmentResult.error) throw new Error("Your fulfillment settings could not be loaded.");
  const store = storeResult.data;
  const fulfillment = fulfillmentResult.data;

  return {
    name: store.name,
    publicDescription: store.public_description ?? "",
    contactEmail: store.store_contact_email ?? "",
    phoneNumber: store.store_phone_number ?? "",
    physicalAddress: store.physical_store_address ?? store.store_address ?? store.address ?? "",
    city: store.city ?? "",
    province: store.province ?? "",
    postalCode: store.postal_code ?? "",
    openingHours: store.opening_hours ?? {},
    fulfillment: {
      ordersEnabled: fulfillment?.orders_enabled ?? true,
      collectionEnabled: fulfillment?.collection_enabled ?? true,
      deliveryEnabled: fulfillment?.delivery_enabled ?? false,
      collectionLeadMinutes: fulfillment?.collection_lead_minutes ?? 30,
      collectionMinimum: Number(fulfillment?.collection_minimum ?? 0),
      collectionFee: Number(fulfillment?.collection_fee ?? 0),
      deliveryMinimum: Number(fulfillment?.delivery_minimum ?? 0),
      deliveryFee: Number(fulfillment?.delivery_fee ?? 0),
      deliveryEtaMinMinutes: fulfillment?.delivery_eta_min_minutes ?? null,
      deliveryEtaMaxMinutes: fulfillment?.delivery_eta_max_minutes ?? null,
      deliveryRadiusKm: fulfillment?.delivery_radius_km == null ? null : Number(fulfillment.delivery_radius_km)
    }
  };
}
