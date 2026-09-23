import "server-only";
import { requireCustomerSession } from "@/lib/customer/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type CustomerOrderItem = {
  id: string;
  productId: string;
  name: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

export type CustomerOrderSummary = {
  id: string;
  orderNumber: string;
  storeName: string;
  storePhone: string | null;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  fulfillmentType: "collection" | "delivery";
  subtotal: number;
  fulfillmentFee: number;
  total: number;
  itemCount: number;
  createdAt: string;
  placedAt: string;
  collectionExpiresAt: string | null;
  items: CustomerOrderItem[];
};

export type CustomerOrderDetail = CustomerOrderSummary & {
  preparingAt: string | null;
  readyAt: string | null;
  collectedAt: string | null;
  outForDeliveryAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  refundedAt: string | null;
  completedAt: string | null;
  forfeitedAt: string | null;
  fulfillment: {
    storeAddress: string | null;
    recipientName: string;
    recipientPhone: string;
    addressLine: string | null;
    suburb: string | null;
    city: string | null;
    province: string | null;
    postalCode: string | null;
    deliveryInstructions: string | null;
    etaMinMinutes: number | null;
    etaMaxMinutes: number | null;
  } | null;
  events: Array<{ id: string; type: string; reason: string | null; occurredAt: string }>;
  deliveryTracking: Array<{
    id: string;
    status: string;
    providerReference: string | null;
    driverName: string | null;
    driverPhone: string | null;
    latitude: number | null;
    longitude: number | null;
    occurredAt: string;
  }>;
  payments: Array<{ id: string; provider: string; type: string; status: string; amount: number; createdAt: string }>;
};

type Relation<T> = T | T[] | null;
type OrderRow = Record<string, unknown> & {
  id: string;
  order_number?: string | null;
  status: string;
  payment_status?: string | null;
  payment_method?: string | null;
  fulfillment_type?: string | null;
  subtotal?: number | string | null;
  fulfillment_fee?: number | string | null;
  total?: number | string | null;
  total_cents?: number | string | null;
  created_at: string;
  placed_at?: string | null;
  collection_expires_at?: string | null;
  stores: Relation<{ name?: string; store_phone_number?: string | null }>;
  order_items?: Array<{
    id: string;
    order_id?: string;
    product_id: string;
    product_name_snapshot: string;
    image_url_snapshot?: string | null;
    unit_price: number | string;
    quantity: number;
    line_total: number | string;
  }>;
};

const SUMMARY_SELECT = "id,order_number,status,payment_status,payment_method,fulfillment_type,subtotal,fulfillment_fee,total,created_at,placed_at,collection_expires_at,stores(name,store_phone_number),order_items(id,product_id,product_name_snapshot,image_url_snapshot,unit_price,quantity,line_total)";
const SUMMARY_WITHOUT_ITEMS_SELECT = "id,order_number,status,payment_status,payment_method,fulfillment_type,subtotal,fulfillment_fee,total,created_at,placed_at,collection_expires_at,stores(name,store_phone_number)";
const LEGACY_SUMMARY_SELECT = "id,status,total_cents,created_at,stores(name,store_phone_number)";
const ORDER_ITEMS_SELECT = "id,order_id,product_id,product_name_snapshot,image_url_snapshot,unit_price,quantity,line_total";

function isSchemaMismatch(error: { message?: string; code?: string } | null | undefined) {
  return Boolean(error && (
    error.code === "PGRST200" ||
    error.code === "PGRST205" ||
    error.code === "42703" ||
    /order_items|order_number|fulfillment_type|image_url_snapshot|collection_expires_at|schema cache|does not exist/i.test(error.message ?? "")
  ));
}

function one<T>(relation: Relation<T>) {
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

function mapItems(items: OrderRow["order_items"] = []): CustomerOrderItem[] {
  return items.map((item) => ({
    id: item.id,
    productId: item.product_id,
    name: item.product_name_snapshot,
    imageUrl: item.image_url_snapshot ?? null,
    unitPrice: Number(item.unit_price),
    quantity: Number(item.quantity),
    lineTotal: Number(item.line_total)
  }));
}

function mapSummary(row: OrderRow): CustomerOrderSummary {
  const store = one(row.stores);
  const items = mapItems(row.order_items);
  const total = row.total ?? (row.total_cents !== undefined && row.total_cents !== null ? Number(row.total_cents) / 100 : 0);
  return {
    id: row.id,
    orderNumber: row.order_number ?? "Order",
    storeName: store?.name ?? "GreenChoice store",
    storePhone: store?.store_phone_number ?? null,
    status: row.status,
    paymentStatus: row.payment_status ?? "awaiting_payment",
    paymentMethod: row.payment_method ?? "card",
    fulfillmentType: row.fulfillment_type === "delivery" ? "delivery" : "collection",
    subtotal: Number(row.subtotal ?? total),
    fulfillmentFee: Number(row.fulfillment_fee ?? 0),
    total: Number(total),
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    createdAt: row.created_at,
    placedAt: row.placed_at ?? row.created_at,
    collectionExpiresAt: row.collection_expires_at ?? null,
    items
  };
}

export function isCurrentOrder(status: string) {
  return ["pending", "placed", "preparing", "ready_for_collection", "out_for_delivery"].includes(status);
}

export async function listCustomerOrders(): Promise<CustomerOrderSummary[]> {
  const session = await requireCustomerSession();
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Order service is unavailable.");
  const primary = await admin.from("orders").select(SUMMARY_SELECT)
    .eq("customer_id", session.user.id).order("created_at", { ascending: false });
  let data: unknown[] | null = primary.data as unknown[] | null;
  let error = primary.error;
  if (isSchemaMismatch(error)) {
    const fallback = await admin.from("orders").select(SUMMARY_WITHOUT_ITEMS_SELECT)
      .eq("customer_id", session.user.id).order("created_at", { ascending: false });
    data = fallback.data as unknown[] | null;
    error = fallback.error;

    if (!error && data?.length) {
      const orderIds = data.map((row) => (row as { id?: unknown }).id).filter((id): id is string => typeof id === "string");
      const itemsResult = await admin.from("order_items").select(ORDER_ITEMS_SELECT).in("order_id", orderIds);
      if (!itemsResult.error) {
        const itemsByOrder = new Map<string, OrderRow["order_items"]>();
        ((itemsResult.data ?? []) as unknown as NonNullable<OrderRow["order_items"]>).forEach((item) => {
          const orderId = item.order_id;
          if (!orderId) return;
          const items = itemsByOrder.get(orderId) ?? [];
          items.push(item);
          itemsByOrder.set(orderId, items);
        });
        data = data.map((row) => ({ ...row as Record<string, unknown>, order_items: itemsByOrder.get((row as { id: string }).id) ?? [] }));
      } else if (!isSchemaMismatch(itemsResult.error)) {
        error = itemsResult.error;
      }
    }
  }
  if (isSchemaMismatch(error)) {
    const legacy = await admin.from("orders").select(LEGACY_SUMMARY_SELECT)
      .eq("customer_id", session.user.id).order("created_at", { ascending: false });
    data = legacy.data as unknown[] | null;
    error = legacy.error;
  }
  if (isSchemaMismatch(error)) {
    return [];
  }
  if (error) throw new Error("Unable to load your orders.");
  return ((data ?? []) as unknown as OrderRow[]).map(mapSummary);
}

export async function getCustomerOrder(orderId: string): Promise<CustomerOrderDetail | null> {
  const session = await requireCustomerSession();
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Order service is unavailable.");
  const { data, error } = await admin.from("orders").select(`${SUMMARY_SELECT},preparing_at,ready_at,collected_at,out_for_delivery_at,delivered_at,cancelled_at,refunded_at,completed_at,forfeited_at,order_fulfillment_details(*),order_events(id,event_type,reason,created_at),order_delivery_tracking(id,status,provider_reference,driver_name,driver_phone,latitude,longitude,occurred_at),payment_transactions(id,provider,transaction_type,status,amount,created_at)`)
    .eq("id", orderId).eq("customer_id", session.user.id).maybeSingle();
  if (error) {
    if (isSchemaMismatch(error) || /order_fulfillment_details|order_delivery_tracking|payment_transactions/i.test(error.message)) return null;
    throw new Error("Unable to load this order.");
  }
  if (!data) return null;
  const row = data as unknown as OrderRow & Record<string, unknown>;
  const fulfillment = one(row.order_fulfillment_details as Relation<Record<string, unknown>>);
  return {
    ...mapSummary(row),
    preparingAt: row.preparing_at as string | null ?? null,
    readyAt: row.ready_at as string | null ?? null,
    collectedAt: row.collected_at as string | null ?? null,
    outForDeliveryAt: row.out_for_delivery_at as string | null ?? null,
    deliveredAt: row.delivered_at as string | null ?? null,
    cancelledAt: row.cancelled_at as string | null ?? null,
    refundedAt: row.refunded_at as string | null ?? null,
    completedAt: row.completed_at as string | null ?? null,
    forfeitedAt: row.forfeited_at as string | null ?? null,
    fulfillment: fulfillment ? {
      storeAddress: fulfillment.store_address_snapshot as string | null,
      recipientName: `${fulfillment.recipient_first_name ?? ""} ${fulfillment.recipient_surname ?? ""}`.trim(),
      recipientPhone: fulfillment.recipient_phone as string,
      addressLine: fulfillment.address_line as string | null,
      suburb: fulfillment.suburb as string | null,
      city: fulfillment.city as string | null,
      province: fulfillment.province as string | null,
      postalCode: fulfillment.postal_code as string | null,
      deliveryInstructions: fulfillment.delivery_instructions as string | null,
      etaMinMinutes: fulfillment.delivery_eta_min_minutes as number | null,
      etaMaxMinutes: fulfillment.delivery_eta_max_minutes as number | null
    } : null,
    events: ((row.order_events ?? []) as Array<Record<string, unknown>>).map((event) => ({
      id: event.id as string,
      type: event.event_type as string,
      reason: event.reason as string | null,
      occurredAt: event.created_at as string
    })).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)),
    deliveryTracking: ((row.order_delivery_tracking ?? []) as Array<Record<string, unknown>>).map((event) => ({
      id: event.id as string,
      status: event.status as string,
      providerReference: event.provider_reference as string | null,
      driverName: event.driver_name as string | null,
      driverPhone: event.driver_phone as string | null,
      latitude: event.latitude as number | null,
      longitude: event.longitude as number | null,
      occurredAt: event.occurred_at as string
    })).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)),
    payments: ((row.payment_transactions ?? []) as Array<Record<string, unknown>>).map((payment) => ({
      id: payment.id as string,
      provider: payment.provider as string,
      type: payment.transaction_type as string,
      status: payment.status as string,
      amount: Number(payment.amount),
      createdAt: payment.created_at as string
    })).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  };
}
