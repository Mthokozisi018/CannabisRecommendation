import "server-only";
import {
  cacheGet,
  cacheSet,
  GREENCHOICE_CACHE_TTLS_SECONDS,
  lowStockSummaryCacheKey,
  managerProductsCacheKey,
  managerStaffAccountsCacheKey,
  receptionistSlotUsageCacheKey
} from "@/lib/cache/redis";
import { categoryAllowsCultivationType, categoryIdFor, categorySlug, PRODUCT_CATEGORIES, VAPE_PRODUCT_TYPES } from "@/lib/manager/options";
import { requireActiveManager } from "@/lib/manager/auth";
import { requireAssignedStoreId } from "@/lib/store-scope";
import type { ProductCategory } from "@/lib/manager/options";

const missingProductDatabaseMessage = "Product database tables are not set up yet. Please apply Supabase migrations.";
const managerProductSelect = "id, product_name, brand, category, subcategory, cultivation_type, description, thc_per_unit_mg, thc_per_packet_mg, facet_values, price, product_status, is_visible_on_pos, image_bucket, image_path, image_url, created_at, updated_at, inventory_stock(current_quantity, low_stock_threshold, updated_at)";
const managerProductSelectWithoutPosVisibility = "id, product_name, brand, category, subcategory, cultivation_type, description, thc_per_unit_mg, thc_per_packet_mg, facet_values, price, product_status, image_bucket, image_path, image_url, created_at, updated_at, inventory_stock(current_quantity, low_stock_threshold, updated_at)";

function managerDataError(error: { message: string }) {
  const lower = error.message.toLowerCase();
  if (lower.includes("schema cache") || lower.includes("could not find the table") || lower.includes("does not exist")) {
    return new Error(missingProductDatabaseMessage);
  }
  return new Error(error.message);
}

function missingPosVisibilityColumn(error: { message: string }) {
  return error.message.toLowerCase().includes("is_visible_on_pos");
}

export type ManagerInventoryProduct = {
  id: string;
  product_name: string;
  brand: string | null;
  category: ProductCategory;
  subcategory: string;
  cultivation_type: string | null;
  description: string | null;
  thc_per_unit_mg: number | null;
  thc_per_packet_mg: number | null;
  facet_values?: {
    packageCount?: number | string | null;
    [key: string]: unknown;
  } | null;
  price: number;
  product_status: "active" | "inactive";
  is_visible_on_pos: boolean;
  image_bucket: string | null;
  image_path: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  inventory_stock: {
    current_quantity: number;
    low_stock_threshold: number;
    updated_at: string;
  } | null;
};

export type ManagerLowStockSummary = {
  productCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  expiringSoonCount: number;
};

type LowStockProductRow = {
  inventory_stock?:
    | {
        current_quantity: number | null;
        low_stock_threshold: number | null;
      }
    | {
        current_quantity: number | null;
        low_stock_threshold: number | null;
      }[]
    | null;
};

export async function listManagerProducts() {
  const { supabase, profile } = await requireActiveManager();
  const storeId = requireAssignedStoreId(profile, "Manager");
  const cacheKey = managerProductsCacheKey(storeId);
  const cached = await cacheGet<ManagerInventoryProduct[]>(cacheKey);
  if (cached) return cached;

  const primaryQuery = await supabase
    .from("products")
    .select(managerProductSelect)
    .eq("store_id", storeId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  let data: unknown[] | null = primaryQuery.data as unknown[] | null;
  let error = primaryQuery.error;

  if (error && missingPosVisibilityColumn(error)) {
    const fallbackQuery = await supabase
      .from("products")
      .select(managerProductSelectWithoutPosVisibility)
      .eq("store_id", storeId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    data = fallbackQuery.data as unknown[] | null;
    error = fallbackQuery.error;
  }

  if (error) throw managerDataError(error);
  const products = ((data ?? []) as unknown[]).map((item) => {
    const row = item as Omit<ManagerInventoryProduct, "inventory_stock"> & { inventory_stock?: ManagerInventoryProduct["inventory_stock"][] | ManagerInventoryProduct["inventory_stock"] };
    return {
      ...row,
      is_visible_on_pos: row.is_visible_on_pos !== false,
      inventory_stock: Array.isArray(row.inventory_stock) ? row.inventory_stock[0] ?? null : row.inventory_stock ?? null
    };
  }) as ManagerInventoryProduct[];
  await cacheSet(cacheKey, products, GREENCHOICE_CACHE_TTLS_SECONDS.managerProducts);
  return products;
}

export async function getManagerLowStockSummary(): Promise<ManagerLowStockSummary> {
  const { supabase, profile } = await requireActiveManager();
  const storeId = requireAssignedStoreId(profile, "Manager");
  const cacheKey = lowStockSummaryCacheKey(storeId);
  const cached = await cacheGet<ManagerLowStockSummary>(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from("products")
    .select("id, inventory_stock(current_quantity, low_stock_threshold)")
    .eq("store_id", storeId)
    .eq("product_status", "active")
    .is("deleted_at", null);
  if (error) throw managerDataError(error);

  const products = ((data ?? []) as LowStockProductRow[]).map((product) => {
    const stock = Array.isArray(product.inventory_stock) ? product.inventory_stock[0] ?? null : product.inventory_stock ?? null;
    return {
      currentQuantity: Number(stock?.current_quantity ?? 0),
      lowStockThreshold: Number(stock?.low_stock_threshold ?? 0)
    };
  });
  const summary = products.reduce<ManagerLowStockSummary>(
    (acc, product) => {
      acc.productCount += 1;
      if (product.currentQuantity <= 0) acc.outOfStockCount += 1;
      else if (product.lowStockThreshold > 0 && product.currentQuantity <= product.lowStockThreshold) acc.lowStockCount += 1;
      return acc;
    },
    { productCount: 0, lowStockCount: 0, outOfStockCount: 0, expiringSoonCount: 0 }
  );

  await cacheSet(cacheKey, summary, GREENCHOICE_CACHE_TTLS_SECONDS.lowStockSummary);
  return summary;
}

export async function listStaffProfiles() {
  const { supabase, profile } = await requireActiveManager();
  const storeId = requireAssignedStoreId(profile, "Manager");
  const { data, error } = await supabase
    .from("staff_profiles")
    .select("id, user_id, auth_user_id, first_name, surname, email, mobile_number, physical_address, role, account_status, is_active, created_at, updated_at, deleted_at")
    .eq("store_id", storeId)
    .neq("account_status", "deleted")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type ManagerReceptionistAccount = {
  id: string;
  first_name: string | null;
  surname: string | null;
  full_name: string | null;
  email: string;
  physical_address: string | null;
  account_status: "active" | "restricted" | "deactivated" | "deleted" | null;
  is_active: boolean | null;
  created_at: string;
};

export type ReceptionistSlotUsage = {
  used: number;
  limit: number;
};

export async function getReceptionistSlotUsage(): Promise<ReceptionistSlotUsage> {
  const { supabase, profile } = await requireActiveManager();
  const storeId = requireAssignedStoreId(profile, "Manager");
  const cacheKey = receptionistSlotUsageCacheKey(storeId);
  const cached = await cacheGet<ReceptionistSlotUsage>(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase.rpc("get_receptionist_slot_usage");
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  const usage = {
    used: Number(row?.slot_count ?? 0),
    limit: Number(row?.slot_limit ?? 5)
  };
  await cacheSet(cacheKey, usage, GREENCHOICE_CACHE_TTLS_SECONDS.receptionistSlotUsage);
  return usage;
}

export async function listCompletedReceptionistAccounts(): Promise<ManagerReceptionistAccount[]> {
  const { supabase, profile } = await requireActiveManager();
  const storeId = requireAssignedStoreId(profile, "Manager");
  const cacheKey = managerStaffAccountsCacheKey(storeId);
  const cached = await cacheGet<ManagerReceptionistAccount[]>(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from("staff_profiles")
    .select("id, first_name, surname, full_name, email, physical_address, account_status, is_active, created_at")
    .eq("store_id", storeId)
    .eq("role", "receptionist")
    .not("auth_user_id", "is", null)
    .eq("profile_setup_complete", true)
    .neq("account_status", "deleted")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const accounts = (data ?? []) as ManagerReceptionistAccount[];
  await cacheSet(cacheKey, accounts, GREENCHOICE_CACHE_TTLS_SECONDS.managerStaffAccounts);
  return accounts;
}

export function legacyProductFields(input: {
  productName: string;
  category: ProductCategory;
  subcategory: string;
  cultivationType: string | null;
  packageCount?: number;
  price: number;
  productStatus: "active" | "inactive";
}) {
  const slug = `${categorySlug(input.productName)}-${crypto.randomUUID().slice(0, 8)}`;
  const stockStatus = "in_stock";
  const isCanonicalVapeProduct = input.category === "Vape Cartridges" && VAPE_PRODUCT_TYPES.includes(input.subcategory as never);
  return {
    category_id: categoryIdFor(input.category),
    subcategory_slug: input.subcategory,
    slug,
    name: input.productName,
    brand: input.productName,
    strain_type: isCanonicalVapeProduct ? input.cultivationType : categoryAllowsCultivationType(input.category) ? input.subcategory : null,
    grow_type: input.cultivationType,
    price_cents: Math.round(input.price * 100),
    is_published: input.productStatus === "active",
    stock_status: stockStatus,
    facet_values: {
      managerCategory: input.category,
      managerSubcategory: input.subcategory,
      cultivationType: input.cultivationType ?? "",
      ...(isCanonicalVapeProduct ? { vapeProductType: input.subcategory, vapeStrainType: input.cultivationType ?? "" } : {}),
      ...(input.category === "Edibles" && input.packageCount ? { packageCount: input.packageCount } : {})
    }
  };
}

export function edibleThcDatabaseFields(input: {
  category: ProductCategory;
  thcPerUnitMg?: number;
  thcPerPacketMg?: number;
}) {
  return {
    thc_per_unit_mg: input.category === "Edibles" ? input.thcPerUnitMg ?? null : null,
    thc_per_packet_mg: input.category === "Edibles" ? input.thcPerPacketMg ?? null : null
  };
}

export function productOptionsScriptData(products: ManagerInventoryProduct[]) {
  return products.map((product) => ({
    id: product.id,
    name: product.product_name,
    category: product.category,
    subcategory: product.subcategory,
    cultivationType: product.cultivation_type,
    currentQuantity: product.inventory_stock?.current_quantity ?? 0
  }));
}

export { PRODUCT_CATEGORIES };
