"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { configuredApplicationUrl } from "@/lib/app-url";
import { reportServerException } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/lib/admin/data";
import { assertRateLimit, verifyOrigin } from "@/lib/security";

export type AdminActionState = { ok: boolean; message: string };

type SafeInviteError = Error & {
  status?: number;
  code?: string;
};

const inviteSchema = z.object({
  email: z.string().trim().email("Please enter a valid manager email.").transform((value) => value.toLowerCase())
});

const invitationIdSchema = z.object({ invitationId: z.string().uuid() });
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

function invitationExpiry() {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

function isMissingExpiresAt(error: { message?: string } | null) {
  return Boolean(error?.message?.includes("expires_at"));
}

function isEmailRateLimitError(error: { message?: string } | null) {
  return Boolean(error?.message && /rate limit/i.test(error.message));
}

function isInviteEmailProviderError(error: unknown) {
  return error instanceof Error && error.message === "Error sending invite email" && (error as SafeInviteError).code === "unexpected_failure";
}

function inviteAuthError(error: { name?: string; message: string; status?: number; code?: string }) {
  return Object.assign(new Error(error.message), {
    name: error.name ?? "SupabaseAuthError",
    status: error.status,
    code: error.code
  }) as SafeInviteError;
}

function adminActionMessage(error: unknown) {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Please enter a valid manager email.";
  if (error instanceof Error && isEmailRateLimitError(error)) {
    return "Supabase email rate limit has been reached. Please wait before sending another invitation, or configure a custom SMTP provider.";
  }
  if (isInviteEmailProviderError(error)) {
    return "Supabase could not send the invite email. Check the Supabase Auth email/SMTP provider settings, then try again.";
  }
  return error instanceof Error ? error.message : "Unable to complete this action. Please try again.";
}

function completedManagerFilter(query: ReturnType<ReturnType<typeof adminClient>["from"]>) {
  return query
    .select("id, email, role, account_status, is_active")
    .eq("role", "manager")
    .or("account_status.eq.active,and(account_status.is.null,is_active.eq.true)");
}

async function getCompletedManagerByEmail(email: string) {
  const { data, error } = await completedManagerFilter(adminClient().from("staff_profiles")).ilike("email", email).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function getAcceptedManagerInvitationByEmail(email: string) {
  const { data, error } = await adminClient()
    .from("manager_invitations")
    .select("id")
    .ilike("email", email)
    .eq("status", "accepted")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

function managerInvitationRedirect(invitationId: string) {
  const redirectBase = process.env.MANAGER_INVITE_REDIRECT_TO || `${configuredApplicationUrl()}/manager/invitation/set-password`;
  return `${redirectBase}${redirectBase.includes("?") ? "&" : "?"}invitation_id=${encodeURIComponent(invitationId)}`;
}

async function sendManagerInvite(email: string, invitationId: string) {
  const redirectTo = managerInvitationRedirect(invitationId);
  const { data, error } = await adminClient().auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { invited_role: "manager", invitation_id: invitationId }
  });
  if (!error) {
    if (!data.user?.id) throw new Error("Manager invitation could not be bound to an Auth user.");
    return data.user.id;
  }

  if (isEmailRateLimitError(error)) throw new Error(adminActionMessage(error));
  throw inviteAuthError(error);
}

async function deleteUnboundManagerInviteAuthUser(authUserId: string | null, invitationId: string) {
  if (!authUserId) return;
  try {
    const admin = adminClient();
    const [{ data: authData }, profileResult] = await Promise.all([
      admin.auth.admin.getUserById(authUserId),
      admin.from("staff_profiles").select("id").eq("auth_user_id", authUserId).maybeSingle()
    ]);
    const user = authData.user;
    if (!profileResult.error && !profileResult.data &&
        user?.user_metadata?.invited_role === "manager" &&
        user.user_metadata?.invitation_id === invitationId) {
      await admin.auth.admin.deleteUser(authUserId);
    }
  } catch {
    // Invitation cleanup must not hide the original bind/send failure.
  }
}

async function resendManagerInvite(email: string, invitationId: string) {
  const { error } = await adminClient().auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: managerInvitationRedirect(invitationId) }
  });
  if (error) throw inviteAuthError(error);
}

export async function inviteManagerAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  try {
    await verifyOrigin();
    const staff = await requireAdminUser();
    await assertRateLimit(`admin:manager-invite:${staff.id}`, 10, 60 * 60_000);
    const parsed = inviteSchema.parse({ email: text(formData, "email") });
    const admin = adminClient();

    const [existingManager, acceptedInvite] = await Promise.all([
      getCompletedManagerByEmail(parsed.email),
      getAcceptedManagerInvitationByEmail(parsed.email)
    ]);
    if (existingManager || acceptedInvite) return { ok: false, message: "A manager account with this email already exists." };

    const { data: existingInvite, error: inviteReadError } = await admin
      .from("manager_invitations")
      .select("id")
      .ilike("email", parsed.email)
      .eq("status", "pending")
      .maybeSingle();
    if (inviteReadError) throw new Error(inviteReadError.message);
    if (existingInvite) {
      return {
        ok: false,
        message: "This manager already has a pending invitation. You can resend or revoke it from Pending Invitations."
      };
    }

    const expiresAt = invitationExpiry();
    let { data: invitation, error: invitationError } = await admin
      .from("manager_invitations")
      .insert({ email: parsed.email, status: "pending", invited_by: staff.id, last_sent_at: new Date().toISOString(), expires_at: expiresAt })
      .select("id")
      .single();
    if (isMissingExpiresAt(invitationError)) {
      const retry = await admin
        .from("manager_invitations")
        .insert({ email: parsed.email, status: "pending", invited_by: staff.id, last_sent_at: new Date().toISOString() })
        .select("id")
        .single();
      invitation = retry.data;
      invitationError = retry.error;
    }
    if (invitationError) throw new Error(invitationError.message);
    if (!invitation) throw new Error("Manager invitation was not created.");

    let authUserId: string | null = null;
    try {
      authUserId = await sendManagerInvite(parsed.email, invitation.id);
      const { error: bindError } = await admin
        .from("manager_invitations")
        .update({ auth_user_id: authUserId })
        .eq("id", invitation.id)
        .eq("status", "pending");
      if (bindError) throw new Error(bindError.message);
    } catch (error) {
      await admin.from("manager_invitations").update({ status: "revoked", revoked_at: new Date().toISOString() }).eq("id", invitation.id);
      await deleteUnboundManagerInviteAuthUser(authUserId, invitation.id);
      throw error;
    }

    await audit("admin_invited_manager", invitation.id, { email: parsed.email, expiresAt });
    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/admin/invitations");
    return { ok: true, message: "Manager invitation sent successfully." };
  } catch (error) {
    await reportServerException("admin_invite_manager_failed", error);
    return { ok: false, message: adminActionMessage(error) };
  }
}

export async function resendInvitationAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  try {
    await verifyOrigin();
    const staff = await requireAdminUser();
    await assertRateLimit(`admin:manager-invite-resend:${staff.id}`, 10, 60 * 60_000);
    const parsed = invitationIdSchema.parse({ invitationId: text(formData, "invitationId") });
    const admin = adminClient();
    const { data: invitation, error } = await admin.from("manager_invitations").select("id, email, status").eq("id", parsed.invitationId).single();
    if (error || !invitation || invitation.status !== "pending") throw new Error("Pending invitation not found.");

    const expiresAt = invitationExpiry();
    await resendManagerInvite(invitation.email, invitation.id);
    let { error: updateError } = await admin.from("manager_invitations").update({
      last_sent_at: new Date().toISOString(),
      expires_at: expiresAt
    }).eq("id", invitation.id);
    if (isMissingExpiresAt(updateError)) {
      const retry = await admin.from("manager_invitations").update({
        last_sent_at: new Date().toISOString()
      }).eq("id", invitation.id);
      updateError = retry.error;
    }
    if (updateError) throw new Error(updateError.message);
    await audit("admin_resent_invitation", invitation.id, { email: invitation.email, expiresAt });
    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/admin/invitations");
    return { ok: true, message: "Invitation resent successfully." };
  } catch (error) {
    await reportServerException("admin_resend_invitation_failed", error);
    return { ok: false, message: adminActionMessage(error) };
  }
}

export async function revokeInvitationAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  try {
    await verifyOrigin();
    const staff = await requireAdminUser();
    await assertRateLimit(`admin:manager-invite-revoke:${staff.id}`, 30, 60 * 60_000);
    const parsed = invitationIdSchema.parse({ invitationId: text(formData, "invitationId") });
    const admin = adminClient();
    const { data: invitation, error } = await admin
      .from("manager_invitations")
      .select("id, email, status, auth_user_id")
      .eq("id", parsed.invitationId)
      .single();
    if (error || !invitation || invitation.status !== "pending") throw new Error("Pending invitation not found.");

    const { error: updateError } = await admin.from("manager_invitations").update({ status: "revoked", revoked_at: new Date().toISOString() }).eq("id", invitation.id);
    if (updateError) throw new Error(updateError.message);
    if (invitation.auth_user_id) {
      const [{ data: authData }, profileResult] = await Promise.all([
        admin.auth.admin.getUserById(invitation.auth_user_id),
        admin.from("staff_profiles").select("id").eq("auth_user_id", invitation.auth_user_id).maybeSingle()
      ]);
      const user = authData.user;
      if (!profileResult.error && !profileResult.data &&
          user?.user_metadata?.invited_role === "manager" &&
          user.user_metadata?.invitation_id === invitation.id) {
        await admin.auth.admin.deleteUser(invitation.auth_user_id);
      }
    }
    await audit("admin_revoked_invitation", invitation.id, { email: invitation.email });
    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/admin/invitations");
    return { ok: true, message: "Invitation revoked successfully." };
  } catch (error) {
    await reportServerException("admin_revoke_invitation_failed", error);
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
    revalidatePath("/dashboard/admin/invitations");
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
