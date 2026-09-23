import "server-only";
import { categoryButtonOrder, categorySlug } from "@/lib/manager/options";
import type { ReceptionistCategory, ReceptionistProduct } from "@/lib/receptionist/products";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireCustomerSession } from "@/lib/customer/auth";

type StoreRow = {
  id: string;
  slug: string;
  name: string;
  currency_code: string;
  address: string | null;
  store_address: string | null;
  physical_store_address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  store_contact_email: string | null;
  store_phone_number: string | null;
  public_description: string | null;
  logo_url: string | null;
  store_image_url?: string | null;
  latitude: number | null;
  longitude: number | null;
  opening_hours: Record<string, unknown> | null;
  store_fulfillment_settings?: StoreFulfillmentRow | StoreFulfillmentRow[] | null;
  store_media?: StoreMediaRow[] | null;
};

type StoreFulfillmentRow = {
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

type StoreMediaRow = { media_type: string; public_url: string; alt_text: string | null; sort_order: number };

export type CustomerFulfillmentSettings = {
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

export type CustomerStore = {
  id: string;
  slug: string;
  name: string;
  currencyCode: string;
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  contactEmail: string | null;
  phoneNumber: string | null;
  description: string | null;
  logoUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  openingHours: Record<string, unknown>;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  fulfillment: CustomerFulfillmentSettings;
  distanceKm: number | null;
};

type ProductRow = {
  id: string;
  store_id: string;
  product_name: string | null;
  category: string | null;
  subcategory: string | null;
  cultivation_type: string | null;
  description: string | null;
  thc_per_unit_mg: number | string | null;
  thc_per_packet_mg: number | string | null;
  facet_values: { packageCount?: number | string | null } | null;
  price: number | string | null;
  product_status: string | null;
  is_visible_on_pos: boolean | null;
  image_url: string | null;
  image_path: string | null;
  size_label: string | null;
  strain_type: string | null;
  created_at: string | null;
  inventory_stock?: { current_quantity: number | null; low_stock_threshold: number | null } | Array<{ current_quantity: number | null; low_stock_threshold: number | null }> | null;
};
type InventoryStockRow = {
  product_id: string;
  current_quantity: number | null;
  low_stock_threshold: number | null;
};

const STORE_COLUMNS_BASE = "id,slug,name,currency_code,address,store_address,physical_store_address,city,province,postal_code,store_contact_email,store_phone_number,public_description,logo_url,latitude,longitude,opening_hours";
const STORE_COLUMNS = `${STORE_COLUMNS_BASE},store_image_url`;
const STORE_SELECT = `${STORE_COLUMNS},store_fulfillment_settings(orders_enabled,collection_enabled,delivery_enabled,collection_lead_minutes,collection_minimum,collection_fee,delivery_minimum,delivery_fee,delivery_eta_min_minutes,delivery_eta_max_minutes,delivery_radius_km),store_media(media_type,public_url,alt_text,sort_order)`;
const PRODUCT_SELECT = "id,store_id,product_name,category,subcategory,cultivation_type,description,thc_per_unit_mg,thc_per_packet_mg,facet_values,price,product_status,is_visible_on_pos,image_url,image_path,size_label,strain_type,created_at,stores!inner(is_active,store_access_status),inventory_stock(current_quantity,low_stock_threshold)";
const STORE_PRODUCT_SELECT = "id,store_id,product_name,category,subcategory,cultivation_type,description,thc_per_unit_mg,thc_per_packet_mg,facet_values,price,product_status,is_visible_on_pos,image_url,image_path,size_label,strain_type,created_at";

function firstStock(row: ProductRow) {
  return Array.isArray(row.inventory_stock) ? row.inventory_stock[0] ?? null : row.inventory_stock ?? null;
}

function numeric(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapProduct(row: ProductRow): ReceptionistProduct {
  const stock = firstStock(row);
  const categoryName = row.category || "Uncategorized";
  return {
    id: row.id,
    name: row.product_name || "Unnamed product",
    categoryName,
    categorySlug: categorySlug(categoryName),
    subcategory: row.subcategory || "General",
    cultivationType: row.cultivation_type,
    description: row.description || "",
    thcPerUnitMg: numeric(row.thc_per_unit_mg),
    thcPerPacketMg: numeric(row.thc_per_packet_mg),
    packageCount: numeric(row.facet_values?.packageCount),
    imageUrl: row.image_url,
    imagePath: row.image_path,
    sizeLabel: row.size_label,
    strainType: row.strain_type,
    sellingPrice: Number(row.price ?? 0),
    productStatus: row.product_status || "inactive",
    isVisibleOnPos: row.is_visible_on_pos !== false,
    isActive: row.product_status === "active",
    isNew: row.created_at ? Date.now() - new Date(row.created_at).getTime() < 30 * 24 * 60 * 60 * 1000 : false,
    quantityAvailable: Number(stock?.current_quantity ?? 0),
    lowStockThreshold: Number(stock?.low_stock_threshold ?? 0)
  };
}

const defaultFulfillment: CustomerFulfillmentSettings = {
  ordersEnabled: true,
  collectionEnabled: true,
  deliveryEnabled: false,
  collectionLeadMinutes: 30,
  collectionMinimum: 0,
  collectionFee: 0,
  deliveryMinimum: 0,
  deliveryFee: 0,
  deliveryEtaMinMinutes: null,
  deliveryEtaMaxMinutes: null,
  deliveryRadiusKm: null
};

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function distanceKm(origin: { latitude: number; longitude: number } | null, row: StoreRow) {
  if (!origin || row.latitude === null || row.longitude === null) return null;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latDelta = radians(row.latitude - origin.latitude);
  const lngDelta = radians(row.longitude - origin.longitude);
  const a = Math.sin(latDelta / 2) ** 2 + Math.cos(radians(origin.latitude)) * Math.cos(radians(row.latitude)) * Math.sin(lngDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function mapStore(row: StoreRow, origin: { latitude: number; longitude: number } | null = null): CustomerStore {
  const fulfillment = firstRelation(row.store_fulfillment_settings);
  const cover = [...(row.store_media ?? [])]
    .filter((item) => item.media_type === "cover")
    .sort((a, b) => a.sort_order - b.sort_order)[0];
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    currencyCode: row.currency_code,
    address: row.physical_store_address || row.store_address || row.address,
    city: row.city,
    province: row.province,
    postalCode: row.postal_code,
    contactEmail: row.store_contact_email,
    phoneNumber: row.store_phone_number,
    description: row.public_description,
    logoUrl: row.logo_url,
    latitude: row.latitude,
    longitude: row.longitude,
    openingHours: row.opening_hours ?? {},
    coverImageUrl: row.store_image_url ?? cover?.public_url ?? null,
    coverImageAlt: cover?.alt_text ?? null,
    fulfillment: fulfillment ? {
      ordersEnabled: fulfillment.orders_enabled,
      collectionEnabled: fulfillment.collection_enabled,
      deliveryEnabled: fulfillment.delivery_enabled,
      collectionLeadMinutes: fulfillment.collection_lead_minutes,
      collectionMinimum: Number(fulfillment.collection_minimum),
      collectionFee: Number(fulfillment.collection_fee),
      deliveryMinimum: Number(fulfillment.delivery_minimum),
      deliveryFee: Number(fulfillment.delivery_fee),
      deliveryEtaMinMinutes: fulfillment.delivery_eta_min_minutes,
      deliveryEtaMaxMinutes: fulfillment.delivery_eta_max_minutes,
      deliveryRadiusKm: numeric(fulfillment.delivery_radius_km)
    } : defaultFulfillment,
    distanceKm: distanceKm(origin, row)
  };
}

type StoreListInput = { search?: string; latitude?: number | null; longitude?: number | null };

export async function listCustomerStores(input: string | StoreListInput = {}) {
  await requireCustomerSession();
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const options = typeof input === "string" ? { search: input } : input;
  let query = supabase.from("stores").select(STORE_SELECT).eq("is_active", true).eq("store_access_status", "active").order("name");
  if (options.search?.trim()) query = query.ilike("name", `%${options.search.trim().replace(/[%_]/g, "")}%`);
  const primary = await query;
  let data: unknown[] | null = primary.data as unknown[] | null;
  let error = primary.error;
  if (error && /store_fulfillment_settings|store_media|schema cache|relationship/i.test(error.message)) {
    let fallback = supabase.from("stores").select(STORE_COLUMNS_BASE).eq("is_active", true).eq("store_access_status", "active").order("name");
    if (options.search?.trim()) fallback = fallback.ilike("name", `%${options.search.trim().replace(/[%_]/g, "")}%`);
    const result = await fallback;
    data = result.data as unknown[] | null;
    error = result.error;
  }
  if (error) throw new Error("Unable to load stores.");
  const origin = typeof options.latitude === "number" && typeof options.longitude === "number"
    ? { latitude: options.latitude, longitude: options.longitude }
    : null;
  return ((data ?? []) as StoreRow[]).map((row) => mapStore(row, origin))
    .sort((a, b) => a.distanceKm !== null && b.distanceKm !== null ? a.distanceKm - b.distanceKm : a.name.localeCompare(b.name));
}

export async function getCustomerStore(storeId: string) {
  await requireCustomerSession();
  const supabase = createSupabaseAdminClient();
  if (!supabase) return null;
  let { data, error } = await supabase.from("stores").select(STORE_SELECT).eq("id", storeId).eq("is_active", true).eq("store_access_status", "active").maybeSingle<StoreRow>();
  if (error && /store_fulfillment_settings|store_media|schema cache|relationship/i.test(error.message)) {
    const fallback = await supabase.from("stores").select(STORE_COLUMNS_BASE).eq("id", storeId).eq("is_active", true).eq("store_access_status", "active").maybeSingle<StoreRow>();
    data = fallback.data;
    error = fallback.error;
  }
  if (error) throw new Error("Unable to load this store.");
  return data ? mapStore(data) : null;
}

export async function listRecentlyViewedStores(limit = 4) {
  const session = await requireCustomerSession();
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const { data, error } = await admin.from("customer_store_views")
    .select("store_id,last_viewed_at")
    .eq("user_id", session.user.id)
    .order("last_viewed_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 12)));
  if (error && /customer_store_views|schema cache/i.test(error.message)) return [];
  if (error) throw new Error("Unable to load recently viewed stores.");
  const ids = (data ?? []).map((row) => row.store_id);
  if (ids.length === 0) return [];
  let { data: storeRows, error: storeError } = await admin.from("stores")
    .select(STORE_SELECT)
    .in("id", ids)
    .eq("is_active", true)
    .eq("store_access_status", "active")
    .returns<StoreRow[]>();
  if (storeError && /store_fulfillment_settings|store_media|schema cache|relationship/i.test(storeError.message)) {
    const fallback = await admin.from("stores")
      .select(STORE_COLUMNS_BASE)
      .in("id", ids)
      .eq("is_active", true)
      .eq("store_access_status", "active")
      .returns<StoreRow[]>();
    storeRows = fallback.data;
    storeError = fallback.error;
  }
  if (storeError) throw new Error("Unable to load recently viewed stores.");
  const stores = ((storeRows ?? []) as StoreRow[]).map((row) => mapStore(row));
  const map = new Map(stores.map((store) => [store.id, store]));
  return ids.flatMap((id) => map.get(id) ? [map.get(id)!] : []);
}

export async function recordCustomerStoreView(storeId: string) {
  const session = await requireCustomerSession();
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const { error } = await admin.rpc("record_customer_store_view", {
    p_customer_user_id: session.user.id,
    p_store_id: storeId
  });
  if (error && !/record_customer_store_view|schema cache/i.test(error.message)) {
    throw new Error("Unable to record this store view.");
  }
}

export async function listCustomerProducts(input: { storeId?: string; search?: string; limit?: number } = {}) {
  await requireCustomerSession();
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  if (input.storeId) {
    const { data: stockRows, error: stockError } = await supabase
      .from("inventory_stock")
      .select("product_id,current_quantity,low_stock_threshold")
      .eq("store_id", input.storeId)
      .limit(input.limit ?? 200);
    if (stockError) throw new Error("Unable to load products.");
    const stockByProduct = new Map(((stockRows ?? []) as InventoryStockRow[]).map((stock) => [stock.product_id, stock]));
    const productIds = [...stockByProduct.keys()];
    if (!productIds.length) return [];
    let productQuery = supabase.from("products").select(STORE_PRODUCT_SELECT)
      .in("id", productIds)
      .is("deleted_at", null)
      .eq("is_published", true)
      .eq("product_status", "active")
      .eq("is_visible_on_pos", true)
      .order("created_at", { ascending: false });
    if (input.search?.trim()) productQuery = productQuery.ilike("product_name", `%${input.search.trim().replace(/[%_]/g, "")}%`);
    const { data, error } = await productQuery;
    if (error) throw new Error("Unable to load products.");
    return ((data ?? []) as ProductRow[]).map((row) => mapProduct({
      ...row,
      inventory_stock: stockByProduct.get(row.id) ?? null
    }));
  }
  let query = supabase.from("products").select(PRODUCT_SELECT)
    .is("deleted_at", null)
    .eq("is_published", true)
    .eq("product_status", "active")
    .eq("is_visible_on_pos", true)
    .eq("stores.is_active", true)
    .eq("stores.store_access_status", "active")
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 200);
  if (input.storeId) query = query.eq("store_id", input.storeId);
  if (input.search?.trim()) query = query.ilike("product_name", `%${input.search.trim().replace(/[%_]/g, "")}%`);
  const { data, error } = await query;
  if (error) throw new Error("Unable to load products.");
  return ((data ?? []) as ProductRow[]).map(mapProduct);
}

export function deriveCustomerCategories(products: ReceptionistProduct[]): ReceptionistCategory[] {
  const counts = new Map<string, ReceptionistCategory>();
  for (const product of products) {
    const current = counts.get(product.categorySlug);
    if (current) current.count += 1;
    else counts.set(product.categorySlug, { name: product.categoryName, slug: product.categorySlug, count: 1 });
  }
  return [...counts.values()].sort((a, b) => categoryButtonOrder(a.name) - categoryButtonOrder(b.name) || a.name.localeCompare(b.name));
}
