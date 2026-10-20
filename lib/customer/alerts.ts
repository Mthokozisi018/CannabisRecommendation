import "server-only";
import { requireCustomerSession } from "@/lib/customer/auth";
import { listCustomerOrders } from "@/lib/customer/orders";
import { buildCustomerAlerts, type CustomerOrderEvent } from "@/lib/customer/alert-model";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function listCustomerAlerts() {
  const session = await requireCustomerSession();
  const orders = await listCustomerOrders();
  if (!orders.length) return [];
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Order updates are unavailable.");
  const { data, error } = await supabase.from("orders")
    .select("id,order_events(id,event_type,created_at)").eq("customer_id", session.user.id);
  if (error && !["PGRST200", "PGRST205", "42703"].includes(error.code)) throw new Error("Unable to load your alerts.");
  const eventsByOrder = new Map<string, CustomerOrderEvent[]>();
  for (const row of data ?? []) eventsByOrder.set(row.id, (row.order_events ?? []).map((event: { id: string; event_type: string; created_at: string }) => ({ id: event.id, type: event.event_type, occurredAt: event.created_at })));
  return buildCustomerAlerts(orders, eventsByOrder);
}
