"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { createManagerAccount } from "@/lib/admin/manager-accounts";
import { reportServerException } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/lib/admin/data";
import { assertRateLimit, verifyOrigin } from "@/lib/security";

export type AdminActionState = { ok: boolean; message: string };

const createManagerSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid manager email address.").max(254),
  temporaryPassword: z.string().min(1, "Enter a temporary password.")
});
const storeAccessSchema = z.object({
  storeId: z.string().uuid(),
  accessStatus: z.enum(["active", "restricted"])
});
const deleteStoreSchema = z.object({
  storeId: z.string().uuid(),
  confirmStoreName: z.string().trim().min(1, "Type the store name to confirm deletion.")
});

function adminClient() {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase admin client is not configured.");
  return admin;
}

async function audit(action: string, recordId: string | null, details: Record<string, unknown>) {
  const staff = await requireAdminUser();
  const storeId = typeof details.storeId === "string" ? details.storeId : null;
  const result = typeof details.result === "string" ? details.result : "success";
  await adminClient().from("audit_logs").insert({
    user_id: staff.id,
    action,
    table_name: "admin_dashboard",
    record_id: recordId,
    store_id: storeId,
    result,
    details
  });
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function adminActionMessage(error: unknown) {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Invalid administrator request.";
  return error instanceof Error ? error.message : "Unable to complete this action. Please try again.";
}

export async function createManagerAccountAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  try {
    await verifyOrigin();
    const session = await requireAdmin();
    await assertRateLimit(`admin:create-manager:${session.authUserId}`, 20, 60 * 60_000);
    const parsed = createManagerSchema.parse({
      email: text(formData, "email"),
      temporaryPassword: text(formData, "temporaryPassword")
    });
    await createManagerAccount(session.authUserId, parsed);
    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/admin/stores");
    return { ok: true, message: "Manager account created. Share the temporary credentials securely. The manager must replace the password and complete personal and store onboarding before dashboard access." };
  } catch (error) {
    // Only controlled messages are returned. Credentials are never logged or echoed.
    return { ok: false, message: adminActionMessage(error) };
  }
}

export async function updateStoreAccessAction(formData: FormData) {
  await verifyOrigin();
  const staff = await requireAdminUser();
  await assertRateLimit(`admin:store-access:${staff.id}`, 30, 60_000);
  const parsed = storeAccessSchema.parse({ storeId: text(formData, "storeId"), accessStatus: text(formData, "accessStatus") });
  const admin = adminClient();
  const { error } = await admin
    .from("stores")
    .update({ store_access_status: parsed.accessStatus, is_active: parsed.accessStatus === "active" })
    .eq("id", parsed.storeId);
  if (error) throw new Error(error.message);
  await audit(parsed.accessStatus === "active" ? "admin_activated_store" : "admin_restricted_store", parsed.storeId, { storeId: parsed.storeId, accessStatus: parsed.accessStatus });
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/admin/payments");
  revalidatePath("/dashboard/manager");
  revalidatePath("/dashboard/receptionist");
}

export async function deleteStoreAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  try {
    await verifyOrigin();
    const adminUser = await requireAdminUser();
    await assertRateLimit(`admin:store-delete:${adminUser.id}`, 5, 60 * 60_000);
    const parsed = deleteStoreSchema.parse({
      storeId: text(formData, "storeId"),
      confirmStoreName: text(formData, "confirmStoreName")
    });
    const admin = adminClient();

    const { data: store, error: storeError } = await admin
      .from("stores")
      .select("id, name")
      .eq("id", parsed.storeId)
      .maybeSingle<{ id: string; name: string }>();
    if (storeError) throw new Error(storeError.message);
    if (!store) throw new Error("Store was not found or has already been deleted.");
    if (parsed.confirmStoreName !== store.name) throw new Error(`Type "${store.name}" to confirm deletion.`);

    const { error: restrictError } = await admin
      .from("stores")
      .update({ store_access_status: "restricted", is_active: false })
      .eq("id", store.id);
    if (restrictError) throw new Error(restrictError.message);

    await audit("admin_store_deletion_converted_to_restriction", store.id, {
      storeId: store.id,
      storeName: store.name,
      accessStatus: "restricted",
      dataPreserved: true
    });

    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/admin/stores");
    revalidatePath("/dashboard/admin/payments");
    revalidatePath("/dashboard/manager");
    revalidatePath("/dashboard/manager/products");
    revalidatePath("/dashboard/manager/inventory");
    revalidatePath("/dashboard/receptionist");
    revalidatePath("/dashboard/receptionist/products");

    return {
      ok: true,
      message: `${store.name} was restricted and all store data was preserved. Permanent deletion requires a separately reviewed retention workflow.`
    };
  } catch (error) {
    await reportServerException("admin_delete_store_failed", error, { storeId: text(formData, "storeId") });
    return { ok: false, message: adminActionMessage(error) };
  }
}
