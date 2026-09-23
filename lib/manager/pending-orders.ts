import "server-only";
import type { DashboardSession } from "@/lib/dashboard-session";
import { getProductImage } from "@/lib/product-images";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type PendingOrderItem = {
  id: string;
  productId: string;
  name: string;
  category: string | null;
  imageUrl: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type PendingOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  paymentMethod: "card" | "cash";
  paymentStatus: string;
  subtotal: number;
  total: number;
  createdAt: string;
  collectionExpiresAt: string | null;
  forfeitEligible: boolean;
  itemCount: number;
  distinctProductCount: number;
  items: PendingOrderItem[];
};

const ORDER_SELECT = "id,order_number,payment_method,payment_status,subtotal,total,created_at,collection_expires_at,customer_first_name_snapshot,customer_surname_snapshot,customer_phone_snapshot,customer_profiles(first_name,surname,phone_number),order_items(id,product_id,product_name_snapshot,category_snapshot,subcategory_snapshot,unit_price,quantity,line_total,products(image_url,image_path,category,subcategory,cultivation_type))";

export async function listManagerPendingOrders(session: DashboardSession): Promise<PendingOrder[]> {
  const storeId = session.assignedStoreId;
  if (!storeId) return [];
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Order service is unavailable.");
  const { data, error } = await admin
    .from("orders")
    .select(ORDER_SELECT)
    .eq("store_id", storeId)
    .eq("status", "pending")
    .or("fulfillment_type.eq.collection,fulfillment_type.is.null")
    .order("created_at", { ascending: false })
    .limit(250);
  if (error) {
    const lower = error.message.toLowerCase();
    if (lower.includes("order_items") || lower.includes("order_number") || lower.includes("schema cache")) return [];
    throw new Error("Unable to load pending orders.");
  }

  return (data ?? []).map((row) => {
    const customerRelation = row.customer_profiles as { first_name?: string; surname?: string; phone_number?: string } | Array<{ first_name?: string; surname?: string; phone_number?: string }> | null;
    const customer = Array.isArray(customerRelation) ? customerRelation[0] : customerRelation;
    const rawItems = (row.order_items ?? []) as Array<Record<string, unknown>>;
    const items = rawItems.map((item) => {
      const productRelation = item.products as Record<string, string | null> | Array<Record<string, string | null>> | null;
      const product = Array.isArray(productRelation) ? productRelation[0] : productRelation;
      const category = String(item.category_snapshot ?? product?.category ?? "") || null;
      return {
        id: String(item.id),
        productId: String(item.product_id),
        name: String(item.product_name_snapshot ?? "Product"),
        category,
        imageUrl: getProductImage({
          image_url: product?.image_url ?? product?.image_path,
          category,
          subcategory: String(item.subcategory_snapshot ?? product?.subcategory ?? "") || null,
          cultivation_type: product?.cultivation_type
        }),
        quantity: Number(item.quantity ?? 0),
        unitPrice: Number(item.unit_price ?? 0),
        lineTotal: Number(item.line_total ?? 0)
      };
    });
    const customerName = [row.customer_first_name_snapshot ?? customer?.first_name, row.customer_surname_snapshot ?? customer?.surname].filter(Boolean).join(" ") || "Customer";
    const collectionExpiresAt = row.collection_expires_at ?? null;
    return {
      id: row.id,
      orderNumber: row.order_number ?? "Order",
      customerName,
      customerPhone: row.customer_phone_snapshot ?? customer?.phone_number ?? "",
      paymentMethod: row.payment_method === "cash" ? "cash" : "card",
      paymentStatus: row.payment_status ?? "awaiting_payment",
      subtotal: Number(row.subtotal ?? 0),
      total: Number(row.total ?? 0),
      createdAt: row.created_at,
      collectionExpiresAt,
      forfeitEligible: Boolean(collectionExpiresAt && new Date(collectionExpiresAt).getTime() <= Date.now()),
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      distinctProductCount: items.length,
      items
    };
  });
}

export async function countManagerPendingOrders(session: DashboardSession) {
  const storeId = session.assignedStoreId;
  if (!storeId) return 0;
  const admin = createSupabaseAdminClient();
  if (!admin) return 0;
  const { count, error } = await admin.from("orders").select("id", { count: "exact", head: true }).eq("store_id", storeId).eq("status", "pending").or("fulfillment_type.eq.collection,fulfillment_type.is.null");
  if (error) return 0;
  return count ?? 0;
}
