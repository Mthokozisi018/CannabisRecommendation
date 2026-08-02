import "server-only";
import { cacheGet, cacheSet, GREENCHOICE_CACHE_TTLS_SECONDS, posProductsCacheKey, productCategoriesCacheKey } from "@/lib/cache/redis";
import { requireStaff } from "@/lib/dal/auth";
import { categoryButtonOrder, categorySlug, VAPE_PRODUCT_TYPES, VAPE_STRAIN_TYPES } from "@/lib/manager/options";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseProductClient = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>> | NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

type ProductStock = {
  current_quantity: number | null;
  low_stock_threshold: number | null;
};

type ProductStockRow = ProductStock | ProductStock[] | null;

type ProductRow = {
  id: string;
  product_name: string | null;
  category: string | null;
  subcategory: string | null;
  cultivation_type: string | null;
  description: string | null;
  thc_per_unit_mg: number | string | null;
  thc_per_packet_mg: number | string | null;
  facet_values: {
    packageCount?: number | string | null;
  } | null;
  price: number | string | null;
  product_status: string | null;
  is_visible_on_pos?: boolean | null;
  image_url: string | null;
  image_path: string | null;
  size_label: string | null;
  strain_type: string | null;
  created_at: string | null;
  inventory_stock?: ProductStockRow;
};

export type ReceptionistProduct = {
  id: string;
  name: string;
  categoryName: string;
  categorySlug: string;
  subcategory: string;
  cultivationType: string | null;
  description: string;
  thcPerUnitMg?: number | null;
  thcPerPacketMg?: number | null;
  packageCount?: number | null;
  imageUrl: string | null;
  imagePath: string | null;
  sizeLabel: string | null;
  strainType: string | null;
  sellingPrice: number;
  productStatus: string;
  isVisibleOnPos?: boolean;
  isActive: boolean;
  isNew: boolean;
  quantityAvailable: number;
  lowStockThreshold: number;
};

export type ReceptionistCategory = {
  name: string;
  slug: string;
  count: number;
};

export type ReceptionistCatalog = {
  source: "supabase";
  products: ReceptionistProduct[];
  categories: ReceptionistCategory[];
  unavailableReason?: string;
};

function firstStock(stock: ProductStockRow): ProductStock | null {
  if (Array.isArray(stock)) return stock[0] ?? null;
  return stock ?? null;
}

function missingSchemaMessage(message: string) {
  const lower = message.toLowerCase();
  return lower.includes("schema cache") || lower.includes("could not find the table") || lower.includes("does not exist");
}

function missingPosVisibilityColumn(message: string) {
  return message.toLowerCase().includes("is_visible_on_pos");
}

const receptionistProductSelect = "id, product_name, category, subcategory, cultivation_type, description, thc_per_unit_mg, thc_per_packet_mg, facet_values, price, product_status, is_visible_on_pos, image_url, image_path, size_label, strain_type, created_at, inventory_stock(current_quantity, low_stock_threshold)";
const receptionistProductSelectWithoutPosVisibility = "id, product_name, category, subcategory, cultivation_type, description, thc_per_unit_mg, thc_per_packet_mg, facet_values, price, product_status, image_url, image_path, size_label, strain_type, created_at, inventory_stock(current_quantity, low_stock_threshold)";

function nullableNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeVapeFields(row: ProductRow) {
  const category = row.category || "Uncategorized";
  const subcategory = row.subcategory || "General";
  const cultivationType = row.cultivation_type;

  if (category === "Disposable Vapes") {
    return {
      categoryName: "Vape Cartridges",
      subcategory: "Disposable Vape",
      cultivationType: cultivationType || (VAPE_STRAIN_TYPES.includes(subcategory as never) ? subcategory : null)
    };
  }

  if (category === "Vape Cartridges") {
    if (VAPE_PRODUCT_TYPES.includes(subcategory as never)) {
      return { categoryName: category, subcategory, cultivationType };
    }
    if (VAPE_STRAIN_TYPES.includes(subcategory as never) && !cultivationType) {
      return { categoryName: category, subcategory: "Vape Cartridge", cultivationType: subcategory };
    }
  }

  return { categoryName: category, subcategory, cultivationType };
}

function normalizeProduct(row: ProductRow): ReceptionistProduct {
  const stock = firstStock(row.inventory_stock ?? null);
  const normalized = normalizeVapeFields(row);

  return {
    id: row.id,
    name: row.product_name || "Unnamed product",
    categoryName: normalized.categoryName,
    categorySlug: categorySlug(normalized.categoryName),
    subcategory: normalized.subcategory,
    cultivationType: normalized.cultivationType,
    description: row.description || "",
    thcPerUnitMg: nullableNumber(row.thc_per_unit_mg),
    thcPerPacketMg: nullableNumber(row.thc_per_packet_mg),
    packageCount: nullableNumber(row.facet_values?.packageCount),
    imageUrl: row.image_url,
    imagePath: row.image_path,
    sizeLabel: row.size_label,
    strainType: row.strain_type,
    sellingPrice: Number(row.price ?? 0),
    productStatus: row.product_status || "inactive",
    isVisibleOnPos: row.is_visible_on_pos !== false,
    isActive: row.product_status === "active",
    isNew: row.created_at ? Date.now() - new Date(row.created_at).getTime() < 1000 * 60 * 60 * 24 * 30 : false,
    quantityAvailable: Number(stock?.current_quantity ?? 0),
    lowStockThreshold: Number(stock?.low_stock_threshold ?? 0)
  };
}

function deriveCategories(products: ReceptionistProduct[]) {
  const categoryMap = new Map<string, ReceptionistCategory>();

  products.forEach((product) => {
    const existing = categoryMap.get(product.categorySlug);
    if (existing) {
      existing.count += 1;
      return;
    }
    categoryMap.set(product.categorySlug, {
      name: product.categoryName,
      slug: product.categorySlug,
      count: 1
    });
  });

  return Array.from(categoryMap.values()).sort((a, b) => categoryButtonOrder(a.name) - categoryButtonOrder(b.name) || a.name.localeCompare(b.name));
}

function filterProducts(products: ReceptionistProduct[], params?: { category?: string; search?: string }) {
  const requestedCategory = params?.category?.trim().toLowerCase();
  const search = params?.search?.trim().toLowerCase();

  return products.filter((product) => {
    const matchesCategory =
      !requestedCategory || product.categorySlug === requestedCategory || product.categoryName.toLowerCase() === requestedCategory;

    const matchesSearch =
      !search ||
      [product.name, product.categoryName, product.subcategory, product.cultivationType, product.description]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(search));

    return matchesCategory && matchesSearch;
  });
}

async function loadVisiblePosProducts(client: SupabaseProductClient, storeId: string) {
  const primaryQuery = await client
    .from("products")
    .select(receptionistProductSelect)
    .is("deleted_at", null)
    .eq("store_id", storeId)
    .eq("product_status", "active")
    .eq("is_visible_on_pos", true)
    .order("product_name", { ascending: true });

  let data: unknown[] | null = primaryQuery.data as unknown[] | null;
  let error = primaryQuery.error;

  if (error && missingPosVisibilityColumn(error.message)) {
    const fallbackQuery = await client
      .from("products")
      .select(receptionistProductSelectWithoutPosVisibility)
      .is("deleted_at", null)
      .eq("store_id", storeId)
      .eq("product_status", "active")
      .order("product_name", { ascending: true });
    data = fallbackQuery.data as unknown[] | null;
    error = fallbackQuery.error;
  }

  return { data, error };
}

function catalogFromProducts(products: ReceptionistProduct[], categories: ReceptionistCategory[], params?: { category?: string; search?: string }): ReceptionistCatalog {
  return {
    source: "supabase",
    products: filterProducts(products, params),
    categories
  };
}

async function cachedCatalogForStore(storeId: string, params?: { category?: string; search?: string }): Promise<ReceptionistCatalog | null> {
  const [products, categories] = await Promise.all([
    cacheGet<ReceptionistProduct[]>(posProductsCacheKey(storeId)),
    cacheGet<ReceptionistCategory[]>(productCategoriesCacheKey(storeId))
  ]);

  if (!products) return null;
  const resolvedCategories = categories ?? deriveCategories(products);
  if (!categories) {
    await cacheSet(productCategoriesCacheKey(storeId), resolvedCategories, GREENCHOICE_CACHE_TTLS_SECONDS.productCategories);
  }
  return catalogFromProducts(products, resolvedCategories, params);
}

export async function listReceptionistCatalog(params?: { category?: string; search?: string }): Promise<ReceptionistCatalog> {
  const staff = await requireStaff(["manager", "receptionist"]);

  const cached = await cachedCatalogForStore(staff.storeId, params);
  if (cached) return cached;

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      source: "supabase",
      products: [],
      categories: [],
      unavailableReason: "Supabase is not configured for this workstation."
    };
  }

  const { data, error } = await loadVisiblePosProducts(supabase, staff.storeId);

  if (error) {
    const unavailableReason = missingSchemaMessage(error.message)
      ? "Supabase product and inventory tables are not available yet. Apply the manager dashboard migration before live POS product browsing."
      : error.message;

    return {
      source: "supabase",
      products: [],
      categories: [],
      unavailableReason
    };
  }

  const allProducts = ((data ?? []) as ProductRow[]).map(normalizeProduct);
  const categories = deriveCategories(allProducts);
  await Promise.all([
    cacheSet(posProductsCacheKey(staff.storeId), allProducts, GREENCHOICE_CACHE_TTLS_SECONDS.posProducts),
    cacheSet(productCategoriesCacheKey(staff.storeId), categories, GREENCHOICE_CACHE_TTLS_SECONDS.productCategories)
  ]);

  return catalogFromProducts(allProducts, categories, params);
}

export async function listReceptionistCatalogForStore(storeId: string, params?: { category?: string; search?: string }): Promise<ReceptionistCatalog> {
  const cached = await cachedCatalogForStore(storeId, params);
  if (cached) return cached;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      source: "supabase",
      products: [],
      categories: [],
      unavailableReason: "Supabase is not configured for this workstation."
    };
  }

  const { data, error } = await loadVisiblePosProducts(admin, storeId);

  if (error) {
    const unavailableReason = missingSchemaMessage(error.message)
      ? "Supabase product and inventory tables are not available yet. Apply the manager dashboard migration before live POS product browsing."
      : error.message;

    return {
      source: "supabase",
      products: [],
      categories: [],
      unavailableReason
    };
  }

  const allProducts = ((data ?? []) as ProductRow[]).map(normalizeProduct);
  const categories = deriveCategories(allProducts);
  await Promise.all([
    cacheSet(posProductsCacheKey(storeId), allProducts, GREENCHOICE_CACHE_TTLS_SECONDS.posProducts),
    cacheSet(productCategoriesCacheKey(storeId), categories, GREENCHOICE_CACHE_TTLS_SECONDS.productCategories)
  ]);

  return catalogFromProducts(allProducts, categories, params);
}

export async function warmReceptionistCatalogForStore(storeId: string): Promise<void> {
  await listReceptionistCatalogForStore(storeId).then(() => undefined);
}
