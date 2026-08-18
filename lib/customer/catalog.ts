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
  store_phone_number: string | null;
  public_description: string | null;
  logo_url: string | null;
  latitude: number | null;
  longitude: number | null;
  opening_hours: Record<string, unknown> | null;
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
  phoneNumber: string | null;
  description: string | null;
  logoUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  openingHours: Record<string, unknown>;
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

const STORE_SELECT = "id,slug,name,currency_code,address,store_address,physical_store_address,city,province,postal_code,store_phone_number,public_description,logo_url,latitude,longitude,opening_hours";
const PRODUCT_SELECT = "id,store_id,product_name,category,subcategory,cultivation_type,description,thc_per_unit_mg,thc_per_packet_mg,facet_values,price,product_status,is_visible_on_pos,image_url,image_path,size_label,strain_type,created_at,stores!inner(is_active,store_access_status),inventory_stock(current_quantity,low_stock_threshold)";

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

function mapStore(row: StoreRow): CustomerStore {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    currencyCode: row.currency_code,
    address: row.physical_store_address || row.store_address || row.address,
    city: row.city,
    province: row.province,
    postalCode: row.postal_code,
    phoneNumber: row.store_phone_number,
    description: row.public_description,
    logoUrl: row.logo_url,
    latitude: row.latitude,
    longitude: row.longitude,
    openingHours: row.opening_hours ?? {}
  };
}

export async function listCustomerStores(search?: string) {
  await requireCustomerSession();
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  let query = supabase.from("stores").select(STORE_SELECT).eq("is_active", true).eq("store_access_status", "active").order("name");
  if (search?.trim()) query = query.ilike("name", `%${search.trim().replace(/[%_]/g, "")}%`);
  const { data, error } = await query;
  if (error) throw new Error("Unable to load stores.");
  return ((data ?? []) as StoreRow[]).map(mapStore);
}

export async function getCustomerStore(storeId: string) {
  await requireCustomerSession();
  const supabase = createSupabaseAdminClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("stores").select(STORE_SELECT).eq("id", storeId).eq("is_active", true).eq("store_access_status", "active").maybeSingle<StoreRow>();
  if (error) throw new Error("Unable to load this store.");
  return data ? mapStore(data) : null;
}

export async function listCustomerProducts(input: { storeId?: string; search?: string; limit?: number } = {}) {
  await requireCustomerSession();
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase is not configured.");
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
