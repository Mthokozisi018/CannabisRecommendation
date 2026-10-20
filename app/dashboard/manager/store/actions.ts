"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCompletedManagerDashboardSession } from "@/lib/manager/onboarding";
import { parseManagerStoreForm } from "@/lib/manager/store-settings-validation";
import { assertRateLimit, verifyOrigin } from "@/lib/security";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ManagerStoreActionState = { ok: boolean; message: string };

function firstIssue(error: unknown) {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Check the store settings and try again.";
  return error instanceof Error ? error.message : "Unable to update your store. Please try again.";
}

function storeRpcUnavailable(message: string) {
  return /update_own_manager_store|schema cache|could not find the function/i.test(message);
}

export async function updateOwnManagerStoreAction(_previous: ManagerStoreActionState, formData: FormData): Promise<ManagerStoreActionState> {
  try {
    await verifyOrigin();
    const session = await requireCompletedManagerDashboardSession();
    if (!session.isManager || !session.assignedStoreId) throw new Error("An assigned manager store is required.");
    await assertRateLimit(`manager:store-update:${session.authUserId}`, 10, 15 * 60_000);

    const payload = parseManagerStoreForm(formData);
    const supabase = await createSupabaseServerClient();
    if (!supabase) throw new Error("Store updates are unavailable.");

    const { data, error } = await supabase.rpc("update_own_manager_store", {
      p_store: payload.store,
      p_fulfillment: payload.fulfillment
    });
    if (error) {
      if (storeRpcUnavailable(error.message)) {
        throw new Error("Store updates are not installed in this database environment yet. Apply the secure manager store migration to local or staging before testing this form.");
      }
      throw new Error(error.message);
    }
    if (data !== session.assignedStoreId) throw new Error("The authenticated store update could not be verified.");

    revalidatePath("/dashboard/manager/store");
    revalidatePath("/dashboard/manager");
    revalidatePath("/customer");
    revalidatePath("/customer/stores");
    revalidatePath(`/customer/stores/${session.assignedStoreId}`);
    return { ok: true, message: "Store details and fulfillment settings were updated." };
  } catch (error) {
    return { ok: false, message: firstIssue(error) };
  }
}
