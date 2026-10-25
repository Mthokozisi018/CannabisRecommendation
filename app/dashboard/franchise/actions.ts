"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  requireFranchiseAdmin,
  requireFranchiseStore,
} from "@/lib/franchise/auth";
import {
  cleanupUnboundFranchiseAuthAccount,
  createFranchiseAuthAccount,
  franchiseMutation,
  franchiseServiceClient,
  verifyFranchiseSensitiveAction,
} from "@/lib/franchise/mutations";
import {
  formValues,
  openingHoursSchema,
  personSchema,
  staffAssignmentSchema,
  storeSchema,
} from "@/lib/franchise/validation";
import type { FranchiseActionState } from "@/lib/franchise/types";
import { normalizeSAPhone, slugForStoreName } from "@/lib/manager/onboarding";
import {
  normalizeStoreImage,
  storeImageObjectPath,
} from "@/lib/product-image-upload";
import { sendStaffPasswordResetLink } from "@/lib/staff-password-reset";
import { assertRateLimit, verifyOrigin } from "@/lib/security";
import { invalidateManagerStaffCache } from "@/lib/cache/redis";
import { billingAccountForSession } from "@/lib/billing/accounts";
import { synchronizeFranchisePlan } from "@/lib/billing/subscriptions";

function message(error: unknown) {
  return error instanceof z.ZodError
    ? (error.issues[0]?.message ?? "Check the form.")
    : error instanceof Error
      ? error.message
      : "The request failed. Please try again.";
}
export async function saveFranchiseStoreAction(
  _previous: FranchiseActionState,
  form: FormData,
): Promise<FranchiseActionState> {
  try {
    await verifyOrigin();
    const input = formValues(form);
    const data = storeSchema.parse(input);
    const { session } = input.storeId
      ? await requireFranchiseStore(z.string().uuid().parse(input.storeId))
      : await requireFranchiseAdmin();
    await assertRateLimit(
      `franchise:store:${session.authUserId}`,
      20,
      60 * 60_000,
    );
    const operation = input.storeId ? "update_store" : "create_store";
    const id = await franchiseMutation(session.authUserId, operation, {
      ...data,
      phone: normalizeSAPhone(data.phone),
      ...(input.storeId
        ? {
            storeId: input.storeId,
            active: input.active === "true",
            openingHours: openingHoursSchema.parse(
              JSON.parse(input.openingHours || "{}"),
            ),
          }
        : { slug: slugForStoreName(data.name), idempotencyKey: z.string().uuid("Refresh the store form and try again.").parse(input.idempotencyKey) }),
    });
    let billingMessage = "";
    try {
      const billingAccount = await billingAccountForSession(session);
      if (billingAccount?.onboarding_paid_at && billingAccount.franchise_id && billingAccount.status === "active") {
        await synchronizeFranchisePlan(billingAccount.id, billingAccount.franchise_id);
      }
    } catch {
      billingMessage = " Billing price update needs attention before the next renewal.";
    }
    revalidatePath("/dashboard/franchise", "layout");
    revalidatePath("/customer/stores", "layout");
    return {
      ok: true,
      id,
      message: input.storeId
        ? `Store changes saved.${billingMessage}`
        : `Store added to your franchise.${billingMessage}`,
    };
  } catch (error) {
    return { ok: false, message: message(error) };
  }
}
export async function createFranchiseStaffAction(
  _previous: FranchiseActionState,
  form: FormData,
): Promise<FranchiseActionState> {
  let authId: string | undefined;
  try {
    await verifyOrigin();
    const input = formValues(form);
    const { session, store } = await requireFranchiseStore(
      z.string().uuid().parse(input.storeId),
    );
    await assertRateLimit(`franchise:staff-create:${session.authUserId}`, 20, 60 * 60_000);
    const data = staffAssignmentSchema.parse(input);
    const role = data.role;
    authId = await createFranchiseAuthAccount(session.authUserId, role, data, {
      storeId: store.id,
      franchiseId: store.franchise_id ?? undefined,
    });
    await franchiseMutation(session.authUserId, "create_staff", {
      authUserId: authId,
      storeId: store.id,
      role,
    });
    await invalidateManagerStaffCache(store.id);
    revalidatePath("/dashboard/franchise", "layout");
    return {
      ok: true,
      message:
        "Account assigned. Share the temporary credentials securely. Account setup is required at first login.",
    };
  } catch (error) {
    if (authId) await cleanupUnboundFranchiseAuthAccount(authId);
    return { ok: false, message: message(error) };
  }
}
export async function manageFranchiseStaffAction(
  _previous: FranchiseActionState,
  form: FormData,
): Promise<FranchiseActionState> {
  try {
    await verifyOrigin();
    const input = formValues(form);
    const { session, store, supabase } = await requireFranchiseStore(
      z.string().uuid().parse(input.storeId),
    );
    await verifyFranchiseSensitiveAction(session, input.actorPassword);
    const staffId = z.string().uuid().parse(input.staffId);
    const action = z
      .enum([
        "edit_staff",
        "restrict_staff",
        "reactivate_staff",
        "deactivate_staff",
        "remove_manager",
        "reset_staff_password",
      ])
      .parse(input.action);
    const { data: target, error } = await supabase
      .from("staff_profiles")
      .select("id,email,role")
      .eq("id", staffId)
      .eq("store_id", store.id)
      .in("role", ["manager", "receptionist"])
      .maybeSingle();
    if (error || !target)
      throw new Error("Staff member not found in this store.");
    const details = action === "edit_staff" ? personSchema.parse(input) : {};
    await franchiseMutation(session.authUserId, action, {
      storeId: store.id,
      staffId,
      ...details,
    });
    if (action === "reset_staff_password")
      await sendStaffPasswordResetLink(target.email);
    await invalidateManagerStaffCache(store.id);
    revalidatePath("/dashboard/franchise", "layout");
    return {
      ok: true,
      message:
        action === "reset_staff_password"
          ? "Password reset requested. Check the account email."
          : "Staff details updated.",
    };
  } catch (error) {
    return { ok: false, message: message(error) };
  }
}
export async function uploadFranchiseStoreImageAction(
  _previous: FranchiseActionState,
  form: FormData,
): Promise<FranchiseActionState> {
  let uploadedPath: string | undefined;
  try {
    await verifyOrigin();
    const { session, store } = await requireFranchiseStore(
      z.string().uuid().parse(form.get("storeId")),
    );
    await assertRateLimit(
      `franchise:image:${session.authUserId}`,
      15,
      60 * 60_000,
    );
    const file = form.get("image");
    if (!(file instanceof File)) throw new Error("Choose a store photograph.");
    const image = await normalizeStoreImage(file);
    const path = storeImageObjectPath(store.id);
    const client = franchiseServiceClient();
    const { error } = await client.storage
      .from("store-images")
      .upload(path, image.data, {
        contentType: image.contentType,
        upsert: false,
      });
    if (error) throw new Error("Store image upload failed.");
    uploadedPath = path;
    const { data } = client.storage.from("store-images").getPublicUrl(path);
    await franchiseMutation(session.authUserId, "store_image", {
      storeId: store.id,
      path,
      url: data.publicUrl,
    });
    uploadedPath = undefined;
    revalidatePath("/dashboard/franchise", "layout");
    revalidatePath("/customer/stores", "layout");
    return { ok: true, message: "Store photograph updated." };
  } catch (error) {
    if (uploadedPath)
      await franchiseServiceClient()
        .storage.from("store-images")
        .remove([uploadedPath]);
    return { ok: false, message: message(error) };
  }
}
