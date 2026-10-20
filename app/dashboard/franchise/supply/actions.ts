"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireFranchiseAdmin } from "@/lib/franchise/auth";
import { requireCompletedManagerDashboardSession } from "@/lib/manager/onboarding";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { assertRateLimit, verifyOrigin } from "@/lib/security";
import { isSupplyDemoAccount, updateSupplyDemoSnapshot } from "@/lib/master-supply/demo-data";
import { applySupplyDemoAction } from "@/lib/master-supply/demo-action";
import { getFranchiseSupplySnapshot } from "@/lib/master-supply/data";

const uuid = z.string().uuid();
const quantity = z.number().int().min(1).max(1_000_000);
const item = z.object({ productId: uuid, quantity }).strict();
const imageUrl = z.string().trim().max(1000).refine(value => !value || value.startsWith("/") || /^https:\/\//i.test(value), "Use an HTTPS image URL or a local image path.");
const schemas = {
  create_product: z.object({ id: uuid, sku: z.string().trim().min(2).max(60), name: z.string().trim().min(2).max(120),
    category: z.string().trim().min(2).max(80), subcategory: z.string().trim().max(80),
    strainType: z.string().trim().max(80), cultivationType: z.string().trim().max(80),
    price: z.number().min(0).max(1_000_000), imageUrl,
    description: z.string().trim().max(2000), quantity: z.number().int().min(0).max(1_000_000) }).strict(),
  add_stock: z.object({ id: uuid, productId: uuid, quantity, reason: z.string().trim().max(500) }).strict(),
  adjust_central: z.object({ id: uuid, productId: uuid, delta: z.number().int().min(-1_000_000).max(1_000_000).refine(value => value !== 0), reason: z.string().trim().min(5).max(500) }).strict(),
  request: z.object({ id: uuid, items: z.array(item).min(1).max(100), notes: z.string().trim().max(500) }).strict(),
  review_request: z.object({ requestId: uuid, decision: z.enum(["approve","partial","reject"]), items: z.array(z.object({ productId: uuid, quantity: z.number().int().min(0).max(1_000_000) }).strict()).max(100) }).strict(),
  distribute: z.object({ id: uuid, storeId: uuid, requestId: uuid.nullable(), deliveryMethod: z.enum(["standard","collection"]),
    notes: z.string().trim().max(500), items: z.array(item).min(1).max(100) }).strict(),
  dispatch: z.object({ distributionId: uuid }).strict(),
  cancel: z.object({ distributionId: uuid }).strict(),
  demo_receive: z.object({ distributionId: uuid }).strict(),
  receive: z.object({ distributionId: uuid, items: z.array(z.object({ productId: uuid, quantity: z.number().int().min(0).max(1_000_000) }).strict()).min(1).max(100) }).strict(),
  restock_refund: z.object({ id: uuid, saleItemId: uuid, quantity, reason: z.string().trim().min(5).max(500), conditionConfirmed: z.literal(true) }).strict()
} as const;

export type SupplyAction = keyof typeof schemas;

export async function masterSupplyAction(action: SupplyAction, input: unknown): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  try {
    await verifyOrigin();
    if (!(action in schemas)) throw new Error("Unknown Master Supply action.");
    const payload = schemas[action].parse(input);
    let actor: string;
    let demoFranchiseId: string | null = null;
    if (action === "request" || action === "receive" || action === "restock_refund") {
      const session = await requireCompletedManagerDashboardSession();
      if (session.profile.role !== "manager" || !session.assignedStoreId) throw new Error("Store manager access required.");
      actor = session.authUserId;
    } else {
      const { session, franchiseId } = await requireFranchiseAdmin();
      actor = session.authUserId;
      if(isSupplyDemoAccount(session)) demoFranchiseId=franchiseId;
    }
    await assertRateLimit(`master-supply:${actor}`, 40, 60_000);
    if(action==="demo_receive"&&!demoFranchiseId) throw new Error("Demo receipt is available only in the local Franchise Admin demo.");
    if(demoFranchiseId) {
      const snapshot=await getFranchiseSupplySnapshot("overview");
      const id=await updateSupplyDemoSnapshot(actor,demoFranchiseId,snapshot.stores,demo=>applySupplyDemoAction(demo,action,payload,actor));
      revalidatePath("/dashboard/franchise/supply","layout");
      return {ok:true,id};
    }
    const client = createSupabaseAdminClient();
    if (!client) throw new Error("Master Supply database is unavailable.");
    const { data, error } = await client.rpc("master_supply_mutation", { p_actor: actor, p_action: action, p_data: payload });
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/franchise/supply", "layout");
    revalidatePath("/dashboard/manager/supply");
    revalidatePath("/dashboard/manager/inventory");
    revalidatePath("/dashboard/receptionist/products");
    return { ok: true, id: String(data) };
  } catch (error) {
    return { ok: false, message: error instanceof z.ZodError ? error.issues[0]?.message ?? "Check the form." : error instanceof Error ? error.message : "Master Supply action failed." };
  }
}
