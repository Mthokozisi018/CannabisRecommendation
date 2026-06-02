import "server-only";
import { LOCAL_STAFF, STORE } from "@/lib/data";
import type { StaffRole } from "@/lib/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getCurrentStaff() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return LOCAL_STAFF;

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const { data } = await supabase
    .from("store_memberships")
    .select("store_id, role, profiles(display_name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    id: user.id,
    email: user.email ?? "",
    displayName: (data.profiles as { display_name?: string } | null)?.display_name ?? user.email ?? "Staff",
    role: data.role as StaffRole,
    storeId: data.store_id
  };
}

export async function requireStaff(roles?: StaffRole[]) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("Staff authentication required.");
  if (roles && !roles.includes(staff.role)) throw new Error("Insufficient staff role.");
  return staff;
}

export async function getCurrentStore() {
  const staff = await getCurrentStaff();
  return { ...STORE, id: staff?.storeId ?? STORE.id };
}
