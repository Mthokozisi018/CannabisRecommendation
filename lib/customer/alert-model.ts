import type { CustomerOrderSummary } from "@/lib/customer/orders";

export type CustomerAlert = {
  id: string; type: string; title: string; message: string; href: string;
  occurredAt: string; timeLabel?: string; urgent: boolean;
};
export type CustomerOrderEvent = { id: string; type: string; occurredAt: string };

const titles: Record<string, string> = {
  created: "Order received", placed: "Order received", pending: "Order received",
  confirmed: "Order accepted", preparing: "Order is being prepared",
  ready_for_collection: "Ready for collection", collection_expired: "Collection time expired",
  collected: "Order collected", delivery_confirmed: "Delivery confirmed",
  out_for_delivery: "Order is out for delivery", delivered: "Order delivered",
  cancelled: "Order cancelled", completed: "Order completed", refunded: "Order refunded",
  forfeited: "Collection time expired",
};

export function buildCustomerAlerts(orders: CustomerOrderSummary[], eventsByOrder: Map<string, CustomerOrderEvent[]>, now = new Date()): CustomerAlert[] {
  const alerts: CustomerAlert[] = [];
  for (const order of orders) {
    const message = `Order ${order.orderNumber} · ${order.storeName}`;
    const href = `/customer/orders/${order.id}`;
    const events = eventsByOrder.get(order.id) ?? [];
    const hasPlacedEvent = events.some((event) => event.type === "placed");
    for (const event of events) {
      if (!titles[event.type]) continue; // Internal/unknown events are not customer notifications.
      if (event.type === "created" && hasPlacedEvent) continue;
      alerts.push({ id: event.id, type: event.type, title: titles[event.type], message, href, occurredAt: event.occurredAt, urgent: event.type === "ready_for_collection" });
    }
    const hasCurrentStatusEvent = events.some((event) => event.type === order.status || (["pending", "placed"].includes(order.status) && ["created", "placed"].includes(event.type)));
    if (!hasCurrentStatusEvent) {
      alerts.push({ id: `status-${order.id}`, type: order.status, title: titles[order.status] ?? "Order update", message: `${message} · Current status`, href, occurredAt: order.placedAt, timeLabel: "Ordered", urgent: order.status === "ready_for_collection" });
    }
    if (order.fulfillmentType === "collection" && ["pending", "placed", "confirmed", "preparing", "ready_for_collection"].includes(order.status) && order.collectionExpiresAt) {
      const remaining = Date.parse(order.collectionExpiresAt) - now.getTime();
      if (remaining > 0 && remaining <= 24 * 60 * 60 * 1000) alerts.push({ id: `collection-${order.id}`, type: "collection_reminder", title: "Collection deadline approaching", message, href, occurredAt: order.collectionExpiresAt, timeLabel: "Collect by", urgent: true });
    }
  }
  return alerts.sort((a, b) => Number(b.urgent) - Number(a.urgent) || Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}
