"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { reportServerException } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/lib/admin/data";
import { assertRateLimit, verifyOrigin } from "@/lib/security";

export type AdminActionState = { ok: boolean; message: string };

const connectManagerSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid manager email address.").max(320)
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

async function authUserByEmail(email: string) {
  const admin = adminClient();
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error("Supabase Auth users could not be checked.");
    const match = data.users.find((user) => user.email?.trim().toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 200) break;
  }
  return null;
}

export async function connectManualManagerAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  try {
    await verifyOrigin();
    const soleAdmin = await requireAdminUser();
    await assertRateLimit(`admin:connect-manual-manager:${soleAdmin.id}`, 20, 60 * 60_000);
    const parsed = connectManagerSchema.parse({ email: text(formData, "email") });
    const admin = adminClient();

    const { data: activeAdmins, error: adminError } = await admin
      .from("staff_profiles")
      .select("auth_user_id, user_id")
      .eq("role", "admin")
      .or("account_status.eq.active,and(account_status.is.null,is_active.eq.true)");
    if (adminError) throw new Error("Administrator identity could not be verified.");
    const activeAdminIds = (activeAdmins ?? []).map((profile) => profile.auth_user_id ?? profile.user_id).filter(Boolean);
    if (activeAdminIds.length !== 1 || activeAdminIds[0] !== soleAdmin.id) {
      throw new Error("Sole administrator validation failed.");
    }

    const authUser = await authUserByEmail(parsed.email);
    if (!authUser) throw new Error("No Supabase Auth user exists for this email.");
    if (authUser.id === soleAdmin.id || parsed.email === process.env.ADMIN_EMAIL?.trim().toLowerCase()) {
      throw new Error("The GreenChoice administrator cannot be converted into a manager.");
    }
    if (!authUser.email_confirmed_at) throw new Error("Confirm this Supabase Auth user before connecting the manager.");
    if (authUser.banned_until && new Date(authUser.banned_until) > new Date()) {
      throw new Error("A banned Supabase Auth user cannot be connected as a manager.");
    }

    const { data: conflicts, error: conflictError } = await admin
      .from("staff_profiles")
      .select("id, role, auth_user_id, user_id, email")
      .or(`auth_user_id.eq.${authUser.id},user_id.eq.${authUser.id},email.ilike.${parsed.email}`);
    if (conflictError) throw new Error("Existing GreenChoice profiles could not be checked.");
    if ((conflicts ?? []).length > 0) {
      const role = conflicts?.[0]?.role;
      throw new Error(role === "manager"
        ? "This Auth user is already connected to a GreenChoice manager profile."
        : "This Auth user or email is already connected to another GreenChoice role.");
    }

    const existingMetadata = authUser.app_metadata ?? {};
    const alreadyConnected = existingMetadata.greenchoice_role === "manager" &&
      existingMetadata.greenchoice_registration === "manual";
    if (!alreadyConnected) {
      const { error: updateError } = await admin.auth.admin.updateUserById(authUser.id, {
        app_metadata: {
          ...existingMetadata,
          greenchoice_role: "manager",
          greenchoice_registration: "manual"
        }
      });
      if (updateError) throw new Error("The manager authorization marker could not be saved.");
    }

    await audit(alreadyConnected ? "admin_confirmed_manual_manager_authorization" : "admin_authorized_manual_manager", authUser.id, {
      targetAuthUserId: authUser.id,
      registration: "manual_supabase",
      result: "success"
    });
    revalidatePath("/dashboard/admin");
    return {
      ok: true,
      message: alreadyConnected
        ? "This Supabase Auth user is already connected for manager onboarding."
        : "Manager connected successfully. They can now sign in and complete onboarding."
    };
  } catch (error) {
    await reportServerException("admin_connect_manual_manager_failed", error);
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
