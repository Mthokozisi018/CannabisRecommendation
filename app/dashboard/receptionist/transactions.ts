"use server";

import { z } from "zod";
import { requireStaff } from "@/lib/dal/auth";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { assertRateLimit, verifyOrigin } from "@/lib/security";
import { paymentSchema } from "@/lib/pos-payment";
import type { POSReceipt } from "@/lib/pos-receipt";
import { revalidatePath } from "next/cache";
import { invalidateFranchiseStoreTotals } from "@/lib/franchise/totals-cache";
import { invalidateStoreDisplayCache } from "@/lib/cache/redis";

export async function getPOSReceiptAction(id: string) {
  try {
    const staff = await requireStaff(["manager", "receptionist"]);
    await assertRateLimit(`pos-receipt:${staff.id}`, 120, 60_000);
    const client = await createSupabaseServerClient();
    if (!client) throw new Error("Transactions unavailable.");
    const { data, error } = await client.rpc("get_pos_receipt", { p_sale_id: z.string().uuid().parse(id), p_store_id: staff.storeId });
    if (error || !data) throw new Error("The saved receipt could not be loaded. Open transaction history to retry.");
    return { ok: true as const, receipt: data as POSReceipt };
  } catch (error) { return { ok: false as const, message: error instanceof Error ? error.message : "Receipt unavailable." }; }
}

export async function searchPOSTransactionsAction(input: unknown) {
  try {
    const staff = await requireStaff(["manager", "receptionist"]);
    const filters = z.object({ search: z.string().trim().max(100), date: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/), page: z.number().int().min(0).max(10000) }).parse(input);
    await assertRateLimit(`pos-history:${staff.id}`, 120, 60_000);
    const client = await createSupabaseServerClient();
    if (!client) throw new Error("Transactions unavailable.");
    const { data, error } = await client.rpc("search_pos_transactions", { p_store_id: staff.storeId, p_search: filters.search, p_date: filters.date || null, p_offset: filters.page * 20 });
    if (error) throw new Error("Transaction history could not be loaded.");
    return { ok: true as const, receipts: data as POSReceipt[] };
  } catch (error) { return { ok: false as const, message: error instanceof Error ? error.message : "History unavailable." }; }
}

export async function amendPOSTransactionAction(input: unknown) {
  try {
    await verifyOrigin();
    const staff = await requireStaff(["manager", "receptionist"]);
    if (staff.storeAccessStatus === "restricted") throw new Error("Store access is restricted.");
    await assertRateLimit(`pos-amend:${staff.id}`, 20, 60_000);
    const parsed = z.object({ saleId: z.string().uuid(), requestId: z.string().uuid(), version: z.number().int().nonnegative(), kind: z.enum(["payment_correction", "refund"]), reason: z.string().trim().min(5).max(1000), payment: paymentSchema, returnedExternally: z.boolean() }).strict().parse(input);
    if (parsed.kind === "refund" && !parsed.returnedExternally) throw new Error("Confirm the money was returned before recording the refund.");
    const client = createSupabaseAdminClient();
    if (!client) throw new Error("Transactions unavailable.");
    const { error } = await client.rpc("amend_pos_transaction", { p_sale_id: parsed.saleId, p_actor_id: staff.id, p_request_id: parsed.requestId, p_version: parsed.version, p_kind: parsed.kind, p_reason: parsed.reason, p_payment: parsed.payment, p_returned_externally: parsed.returnedExternally });
    if (error) throw new Error(error.message);
    await invalidateStoreDisplayCache(staff.storeId);
    invalidateFranchiseStoreTotals(staff.storeId);
    revalidatePath("/dashboard/franchise", "layout");
    revalidatePath("/dashboard/manager/sales");
    revalidatePath("/dashboard/manager");
    return await getPOSReceiptAction(parsed.saleId);
  } catch (error) { return { ok: false as const, message: error instanceof Error ? error.message : "Transaction update failed." }; }
}
