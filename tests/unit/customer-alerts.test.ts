import { describe, expect, it } from "vitest";
import { buildCustomerAlerts } from "@/lib/customer/alert-model";
import type { CustomerOrderSummary } from "@/lib/customer/orders";

const order: CustomerOrderSummary = { id: "order", orderNumber: "GC-1", storeName: "Store One", storePhone: null, status: "ready_for_collection", paymentStatus: "paid", paymentMethod: "card", fulfillmentType: "collection", subtotal: 100, fulfillmentFee: 0, total: 100, itemCount: 1, createdAt: "2026-10-01T08:00:00Z", placedAt: "2026-10-01T08:00:00Z", collectionExpiresAt: "2026-10-03T15:00:00Z", items: [] };
const now = new Date("2026-10-03T08:00:00Z");

describe("customer order alerts", () => {
  it("uses persisted event timestamps and links to the correct order", () => {
    const result = buildCustomerAlerts([order], new Map([[order.id, [{ id: "accepted", type: "confirmed", occurredAt: "2026-10-02T08:00:00Z" }]]]), now);
    expect(result.find((alert) => alert.id === "accepted")).toMatchObject({ title: "Order accepted", occurredAt: "2026-10-02T08:00:00Z", href: "/customer/orders/order", message: "Order GC-1 · Store One" });
    expect(result.find((alert) => alert.id === "status-order")).toMatchObject({ title: "Ready for collection", timeLabel: "Ordered" });
    expect(result[0]).toMatchObject({ type: "collection_reminder", timeLabel: "Collect by", occurredAt: order.collectionExpiresAt });
  });
  it("labels the fallback as a current status, without fabricating a status-change time", () => {
    const result = buildCustomerAlerts([order], new Map(), now);
    expect(result.find((alert) => alert.id === "status-order")).toMatchObject({ title: "Ready for collection", timeLabel: "Ordered", occurredAt: order.placedAt });
  });
  it.each(["cancelled", "collected", "completed", "forfeited", "refunded"])("never reminds customers to collect %s orders", (status) => {
    expect(buildCustomerAlerts([{ ...order, status }], new Map(), now).some((alert) => alert.type === "collection_reminder")).toBe(false);
  });
  it("does not expose internal events, expired deadlines, or invented alerts", () => {
    expect(buildCustomerAlerts([], new Map(), now)).toEqual([]);
    const result = buildCustomerAlerts([{ ...order, collectionExpiresAt: "2026-10-02T08:00:00Z" }], new Map([[order.id, [{ id: "internal", type: "internal_note", occurredAt: now.toISOString() }]]]), now);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("status-order");
  });
  it("shows one received alert for the created and placed events of a pending order", () => {
    const events = ["created", "placed"].map((type) => ({ id: type, type, occurredAt: order.placedAt }));
    const result = buildCustomerAlerts([{ ...order, status: "pending", collectionExpiresAt: null }], new Map([[order.id, events]]), now);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("placed");
  });
  it("shows the real current cancellation status when older events contain only placement", () => {
    const result = buildCustomerAlerts([{ ...order, status: "cancelled" }], new Map([[order.id, [{ id: "placed", type: "placed", occurredAt: order.placedAt }]]]), now);
    expect(result.find((alert) => alert.id === "status-order")).toMatchObject({ title: "Order cancelled", timeLabel: "Ordered", occurredAt: order.placedAt });
  });
});
