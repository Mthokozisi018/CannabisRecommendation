import "server-only";
import { invalidateFranchiseTotals } from "./totals-cache";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";
import type { DashboardSession } from "@/lib/dashboard-session";
import { assertRateLimit } from "@/lib/security";
import { reportServerException } from "@/lib/logger";

export function franchiseServiceClient() {
  const client = createSupabaseAdminClient();
  if (!client)
    throw new Error("Account administration is temporarily unavailable.");
  return client;
}
export async function franchiseMutation(
  actor: string,
  action: string,
  data: Record<string, unknown>,
) {
  const { data: id, error } = await franchiseServiceClient().rpc(
    action === "create_store" ? "franchise_mutation_v2" : "franchise_mutation",
    { p_actor: actor, p_action: action, p_data: data },
  );
  if (error) {
    await reportServerException("franchise_mutation_failed", error, {
      actor,
      action,
    });
    if (/limit reached|already has|Activate this store|request key was already used/.test(error.message))
      throw new Error(error.message);
    throw new Error(
      "The change could not be saved. Check your access and database configuration, then try again.",
    );
  }
  invalidateFranchiseTotals(actor);
  return String(id);
}
export async function verifyFranchiseSensitiveAction(
  session: DashboardSession,
  password: string,
) {
  await assertRateLimit(
    `franchise:reauth:${session.authUserId}`,
    8,
    15 * 60_000,
  );
  if (!password)
    throw new Error("Enter your current password to confirm this action.");
  const client = await createSupabaseServerClient();
  const result = await client?.auth.signInWithPassword({
    email: session.email,
    password,
  });
  if (result?.error || result?.data.user?.id !== session.authUserId)
    throw new Error("Password verification failed.");
}
export async function createFranchiseAuthAccount(
  actor: string,
  role: "franchise_admin" | "manager" | "receptionist",
  data: { email: string; password: string },
  scope: { storeId?: string; franchiseId?: string },
) {
  const client = franchiseServiceClient();
  const { data: auth, error } = await client.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    app_metadata: {
      greenchoice_role: role,
      greenchoice_created_by: actor,
      greenchoice_franchise_id: scope.franchiseId,
      greenchoice_store_id: scope.storeId,
      greenchoice_manager_id: actor,
      greenchoice_registration:
        role === "receptionist" ? "manager_created" : "franchise_created",
    },
  });
  if (error || !auth.user)
    throw new Error(
      error?.code === "weak_password"
        ? error.message
        : "Account creation failed. Check the email and authentication provider password requirements; the email may already belong to an account.",
    );
  return auth.user.id;
}
export async function cleanupUnboundFranchiseAuthAccount(id: string) {
  const client = franchiseServiceClient();
  const { data, error } = await client
    .from("staff_profiles")
    .select("id")
    .eq("auth_user_id", id)
    .maybeSingle();
  if (!error && !data) await client.auth.admin.deleteUser(id);
}
