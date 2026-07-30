import "server-only";
import { cache } from "react";
import { requireAdminUser } from "@/lib/admin/data";
import type { LoggedInStaffSummary, ManagerDashboardSummary } from "@/lib/manager/dashboard-summary";
import type { ManagerInventoryProduct } from "@/lib/manager/data";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const ADMIN_DEMO_STORE_SLUG = "greenchoice-admin-demo-store";
export const ADMIN_DEMO_STORE_NAME = "GreenChoice Demo Store";

export type AdminDemoStore = {
  id: string;
  slug: string;
  name: string;
  store_access_status?: "active" | "restricted" | null;
};

export type AdminDemoStoreContext = {
  adminUserId: string;
  adminEmail: string;
  adminDisplayName: string;
  store: AdminDemoStore;
  storeId: string;
};

const STORE_TIME_ZONE = "Africa/Johannesburg";

export function requireAdminDemoClient() {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase admin client is not configured.");
  return admin;
}

async function getOrCreateAdminDemoStoreForAdmin(staff: Awaited<ReturnType<typeof requireAdminUser>>): Promise<AdminDemoStore> {
  const admin = requireAdminDemoClient();
  const { data: existingStore, error: readError } = await admin
    .from("stores")
    .select("id, slug, name, store_access_status, created_by_manager_id")
    .eq("slug", ADMIN_DEMO_STORE_SLUG)
    .maybeSingle<AdminDemoStore & { created_by_manager_id?: string | null }>();
  if (readError) throw new Error(readError.message);

  const now = new Date().toISOString();
  const storePayload = {
    slug: ADMIN_DEMO_STORE_SLUG,
    name: ADMIN_DEMO_STORE_NAME,
    address: "Admin demo environment",
    store_address: "Admin demo environment",
    physical_store_address: "Admin demo environment",
    store_access_status: "active",
    is_active: true,
    created_by_manager_id: staff.id,
    store_information_confirmed_at: now,
    store_information_confirmed_by: staff.id
  };

  if (existingStore) {
    if (existingStore.name !== ADMIN_DEMO_STORE_NAME) {
      throw new Error("The reserved Admin Demo Store identity is already in use.");
    }
    if (existingStore.store_access_status !== "active") {
      throw new Error("The Admin Demo Store is restricted. Activate it through Payments & Subscriptions before opening it.");
    }
    return existingStore;
  }

  const { data: createdStore, error: createError } = await admin
    .from("stores")
    .insert(storePayload)
    .select("id, slug, name, store_access_status")
    .single<AdminDemoStore>();
  if (createError) throw new Error(createError.message);
  return createdStore;
}

const requireAdminDemoStoreContextCached = cache(async (): Promise<AdminDemoStoreContext> => {
  const staff = await requireAdminUser();
  const store = await getOrCreateAdminDemoStoreForAdmin(staff);

  return {
    adminUserId: staff.id,
    adminEmail: staff.email,
    adminDisplayName: staff.displayName,
    store,
    storeId: store.id
  };
});

export async function requireAdminDemoStoreContext() {
  return requireAdminDemoStoreContextCached();
}

export async function getOrCreateAdminDemoStore(): Promise<AdminDemoStore> {
  const context = await requireAdminDemoStoreContext();
  return context.store;
}

function datePartsInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second")
  };
}

function zonedDateTimeToUtc(parts: { year: number; month: number; day: number; hour?: number; minute?: number; second?: number }, timeZone: string) {
  const utcGuess = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour ?? 0, parts.minute ?? 0, parts.second ?? 0));
  const formatted = datePartsInTimeZone(utcGuess, timeZone);
  const formattedAsUtc = Date.UTC(formatted.year, formatted.month - 1, formatted.day, formatted.hour, formatted.minute, formatted.second);
  return new Date(utcGuess.getTime() - (formattedAsUtc - utcGuess.getTime()));
}

function todayBounds(timeZone = STORE_TIME_ZONE) {
  const today = datePartsInTimeZone(new Date(), timeZone);
  const start = zonedDateTimeToUtc({ year: today.year, month: today.month, day: today.day }, timeZone);
  const end = zonedDateTimeToUtc({ year: today.year, month: today.month, day: today.day + 1 }, timeZone);
  return { start, end };
}

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "DM";
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("");
}

export const getAdminDemoManagerDashboardSummary = cache(async (): Promise<ManagerDashboardSummary> => {
  const context = await requireAdminDemoStoreContext();
  const admin = requireAdminDemoClient();
  const { start, end } = todayBounds();

  const { data: sales, error: salesError } = await admin
    .from("pos_sales")
    .select("total")
    .eq("store_id", context.storeId)
    .eq("status", "completed")
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());
  if (salesError) throw new Error(salesError.message);

  const { data: authUser, error: authError } = await admin.auth.admin.getUserById(context.adminUserId);
  if (authError) throw new Error(authError.message);

  const totalSalesToday = (sales ?? []).reduce((sum, sale) => sum + Number(sale.total ?? 0), 0);
  const signedInAt = authUser.user?.last_sign_in_at ? new Date(authUser.user.last_sign_in_at) : null;
  const loggedInToday: LoggedInStaffSummary[] = signedInAt && signedInAt >= start && signedInAt < end
    ? [{
        id: context.adminUserId,
        name: context.adminDisplayName || context.adminEmail || "Demo Manager",
        initials: initials(context.adminDisplayName || context.adminEmail || "Demo Manager"),
        role: "manager",
        signedInAt: signedInAt.toISOString()
      }]
    : [];

  return { totalSalesToday, loggedInToday };
});

function managerDataError(error: { message: string }) {
  const lower = error.message.toLowerCase();
  if (lower.includes("schema cache") || lower.includes("could not find the table") || lower.includes("does not exist")) {
    return new Error("Product database tables are not set up yet. Please apply Supabase migrations.");
  }
  return new Error(error.message);
}

function missingPosVisibilityColumn(error: { message: string }) {
  return error.message.toLowerCase().includes("is_visible_on_pos");
}

const managerProductSelect = "id, product_name, category, subcategory, cultivation_type, description, thc_per_unit_mg, thc_per_packet_mg, facet_values, price, product_status, is_visible_on_pos, image_bucket, image_path, image_url, created_at, updated_at, inventory_stock(current_quantity, low_stock_threshold, updated_at)";
const managerProductSelectWithoutPosVisibility = "id, product_name, category, subcategory, cultivation_type, description, thc_per_unit_mg, thc_per_packet_mg, facet_values, price, product_status, image_bucket, image_path, image_url, created_at, updated_at, inventory_stock(current_quantity, low_stock_threshold, updated_at)";

export async function listAdminDemoManagerProducts(): Promise<ManagerInventoryProduct[]> {
  const context = await requireAdminDemoStoreContext();
  const admin = requireAdminDemoClient();
  const primaryQuery = await admin
    .from("products")
    .select(managerProductSelect)
    .eq("store_id", context.storeId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  let data: unknown[] | null = primaryQuery.data as unknown[] | null;
  let error = primaryQuery.error;

  if (error && missingPosVisibilityColumn(error)) {
    const fallbackQuery = await admin
      .from("products")
      .select(managerProductSelectWithoutPosVisibility)
      .eq("store_id", context.storeId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    data = fallbackQuery.data as unknown[] | null;
    error = fallbackQuery.error;
  }

  if (error) throw managerDataError(error);

  return ((data ?? []) as unknown[]).map((item) => {
    const row = item as Omit<ManagerInventoryProduct, "inventory_stock"> & { inventory_stock?: ManagerInventoryProduct["inventory_stock"][] | ManagerInventoryProduct["inventory_stock"] };
    return {
      ...row,
      is_visible_on_pos: row.is_visible_on_pos !== false,
      inventory_stock: Array.isArray(row.inventory_stock) ? row.inventory_stock[0] ?? null : row.inventory_stock ?? null
    };
  }) as ManagerInventoryProduct[];
}
