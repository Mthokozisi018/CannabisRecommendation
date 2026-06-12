import "server-only";
import { cookies } from "next/headers";

export type ApiList<T> = { data: T[]; meta: { count: number; source: string } };
export type ApiItem<T> = { data: T; meta: { source: string } };

export type GreenChoiceCategory = {
  id: number;
  name: string;
  slug: string;
  description: string;
  icon: string;
  is_active: boolean;
};

export type GreenChoiceProduct = {
  id: number;
  name: string;
  sku: string;
  categoryName: string;
  categorySlug: string;
  subcategory: string;
  description: string;
  image_url: string;
  unit_size: string;
  selling_price: string;
  is_active: boolean;
  is_archived: boolean;
  is_new: boolean;
  quantityAvailable: number;
  lowStockThreshold: number;
  expiryDate?: string | null;
  hasActivePromotion: boolean;
};

export type InventorySummary = {
  totalStockUnits: number;
  totalEstimatedStockValue: string;
  lowStockCount: number;
  outOfStockCount: number;
  productCount?: number;
  staffCount?: number;
  promotionCount?: number;
  salesCount?: number;
  categories: { id: number; name: string; slug: string; icon: string; totalUnits: number; estimatedValue: string }[];
};

export type LowStockRow = {
  id: number;
  productName: string;
  category: string;
  quantityAvailable: number;
  lowStockThreshold: number;
  estimatedStockValue: string;
  expiryDate?: string | null;
  lastUpdated: string;
  status: "LOW_STOCK" | "OUT_OF_STOCK" | "EXPIRING_SOON";
};

export type StaffAccount = {
  id: number;
  email: string;
  fullName: string;
  role: "MANAGER" | "RECEPTIONIST";
  is_active: boolean;
  last_login?: string | null;
};

export type SaleRecord = {
  id: number;
  transaction_number: string;
  receptionistName: string;
  customerName: string;
  subtotal: string;
  discount_total: string;
  tax_total: string;
  total: string;
  payment_status: string;
  sale_status: string;
  created_at: string;
  items: { id: number; product_name_snapshot: string; unit_price_snapshot: string; quantity: number; line_total: string }[];
};

export type PromotionRecord = {
  id: number;
  name: string;
  description: string;
  discount_type: string;
  discount_value: string;
  categoryName?: string;
  productName?: string;
  minimum_cart_total: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
};

function apiBaseUrl() {
  const configuredUrl = process.env.GREENCHOICE_API_BASE_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") {
    throw new Error("GREENCHOICE_API_BASE_URL must be configured in production.");
  }
  return "http://127.0.0.1:8000/api/v2";
}

async function djangoCookieHeader() {
  const store = await cookies();
  const sessionid = store.get("sessionid")?.value;
  const csrftoken = store.get("csrftoken")?.value;
  return [sessionid ? `sessionid=${sessionid}` : "", csrftoken ? `csrftoken=${csrftoken}` : ""].filter(Boolean).join("; ");
}

export async function greenChoiceFetch<T>(path: string): Promise<T> {
  const cookieHeader = await djangoCookieHeader();
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    cache: "no-store",
    headers: cookieHeader ? { Cookie: cookieHeader } : undefined
  });

  if (!response.ok) {
    throw new Error(`GreenChoice API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function listGreenChoiceCategories() {
  return greenChoiceFetch<ApiList<GreenChoiceCategory>>("/greenchoice/categories/");
}

export async function listGreenChoiceProducts(params?: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return greenChoiceFetch<ApiList<GreenChoiceProduct>>(`/greenchoice/products/${suffix}`);
}

export async function getManagerSummary() {
  return greenChoiceFetch<ApiItem<InventorySummary>>("/greenchoice/manager/summary/");
}

export async function getInventorySummary() {
  return greenChoiceFetch<ApiItem<InventorySummary>>("/greenchoice/manager/inventory/");
}

export async function getLowStockRows() {
  return greenChoiceFetch<ApiList<LowStockRow>>("/greenchoice/manager/low-stock/");
}

export async function getSales() {
  return greenChoiceFetch<ApiList<SaleRecord>>("/greenchoice/manager/sales/");
}

export async function getStaffAccounts() {
  return greenChoiceFetch<ApiList<StaffAccount>>("/greenchoice/manager/staff/");
}

export async function getPromotions() {
  return greenChoiceFetch<ApiList<PromotionRecord>>("/greenchoice/manager/promotions/");
}
