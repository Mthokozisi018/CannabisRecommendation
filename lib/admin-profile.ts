import "server-only";
import { normalizeAuthEmail } from "@/lib/admin-auth";
import type { StaffProfileRow } from "@/lib/staff-profile";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const ADMIN_PROFILE_SELECT = "id, auth_user_id, user_id, store_id, email, full_name, role, is_active, account_status";

type AdminClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
type AuthenticatedUser = {
  id: string;
  email?: string | null;
};

async function readAdminProfile(admin: AdminClient, user: AuthenticatedUser) {
  const byAuthUser = await admin
    .from("staff_profiles")
    .select(ADMIN_PROFILE_SELECT)
    .eq("auth_user_id", user.id)
    .maybeSingle<StaffProfileRow>();
  if (byAuthUser.error) throw new Error(byAuthUser.error.message);
  if (byAuthUser.data) return byAuthUser.data;

  const email = normalizeAuthEmail(user.email);
  if (!email) return null;

  const byEmail = await admin
    .from("staff_profiles")
    .select(ADMIN_PROFILE_SELECT)
    .ilike("email", email)
    .maybeSingle<StaffProfileRow>();
  if (byEmail.error) throw new Error(byEmail.error.message);
  return byEmail.data ?? null;
}

/** @deprecated Administrator profiles must be provisioned explicitly, never repaired during a request. */
export async function ensureAdminStaffProfile(user: AuthenticatedUser) {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase admin client is not configured.");
  const existingProfile = await readAdminProfile(admin, user);
  if (!existingProfile ||
      existingProfile.role !== "admin" ||
      existingProfile.account_status !== "active" ||
      existingProfile.is_active === false ||
      normalizeAuthEmail(existingProfile.email) !== normalizeAuthEmail(user.email)) {
    return null;
  }
  return existingProfile;
}
