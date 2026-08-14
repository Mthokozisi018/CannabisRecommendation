import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { hasManualManagerMarker } from "@/lib/manual-manager-marker";

export async function bootstrapManualManagerProfile(supabase: SupabaseClient, user: User) {
  if (!hasManualManagerMarker(user.app_metadata)) return false;

  // The marker check above is only a fast preflight. The database function is
  // authoritative and re-reads app_metadata directly from auth.users.
  const { data, error } = await supabase.rpc("bootstrap_manual_manager_profile");
  if (error) throw new Error("Manual manager profile initialization failed.");
  const result = Array.isArray(data) ? data[0] : data;
  return Boolean(result?.profile_id);
}
