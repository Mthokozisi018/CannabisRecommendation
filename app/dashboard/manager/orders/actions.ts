"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCompletedManagerDashboardSession } from "@/lib/manager/onboarding";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { assertRateLimit, verifyOrigin } from "@/lib/security";

const orderActionSchema = z.object({ orderId: z.string().uuid() }).strict();
export type ManagerOrderActionResult = { ok: boolean; message: string };

async function transitionOrder(input: unknown, operation: "confirm" | "forfeit"): Promise<ManagerOrderActionResult> {
  try {
    await verifyOrigin();
    const session = await requireCompletedManagerDashboardSession();
    const parsed = orderActionSchema.parse(input);
    await assertRateLimit(`manager-order:${session.authUserId}`, 30, 60_000);
    const admin = createSupabaseAdminClient();
    if (!admin) throw new Error("Order service is unavailable.");
    const { data: order } = await admin.from("orders").select("store_id,fulfillment_type").eq("id", parsed.orderId).maybeSingle();
    if (!order || order.store_id !== session.assignedStoreId) return { ok: false, message: "This order does not belong to your store." };
    if (order.fulfillment_type === "delivery") return { ok: false, message: "Delivery orders require the delivery lifecycle, not collection confirmation." };
    const functionName = operation === "confirm" ? "confirm_customer_collection_order" : "forfeit_customer_collection_order";
    const { error } = await admin.rpc(functionName, { p_order_id: parsed.orderId, p_actor_user_id: session.authUserId });
    if (error) {
      const lower = error.message.toLowerCase();
      if (lower.includes("access denied")) return { ok: false, message: "This order does not belong to your store." };
      if (lower.includes("no longer pending") || lower.includes("changed")) return { ok: false, message: "This order has already been processed. Refreshing the list is recommended." };
      if (lower.includes("reserved inventory")) return { ok: false, message: "Reserved inventory could not be verified. Contact an administrator." };
      if (lower.includes("has not expired")) return { ok: false, message: "This collection order is still within its four-day reservation period." };
      if (lower.includes("not eligible")) return { ok: false, message: "This order is not eligible for forfeiture." };
      if (lower.includes(functionName) || lower.includes("schema cache")) return { ok: false, message: "Pending-order actions are unavailable until the migration is applied." };
      return { ok: false, message: `Unable to ${operation} this order.` };
    }
    revalidatePath("/dashboard/manager");
    revalidatePath("/dashboard/manager/orders");
    revalidatePath("/dashboard/manager/inventory");
    revalidatePath("/dashboard/manager/sales");
    revalidatePath("/customer/orders");
    return { ok: true, message: operation === "confirm" ? "Sale confirmed and collection completed." : "Order forfeited and stock released." };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, message: "Invalid order." };
    return { ok: false, message: error instanceof Error ? error.message : `Unable to ${operation} this order.` };
  }
}

export async function confirmPendingOrderAction(input: unknown) {
  return transitionOrder(input, "confirm");
}

export async function forfeitPendingOrderAction(input: unknown) {
  return transitionOrder(input, "forfeit");
}
