import "server-only";
import { LOCAL_STAFF, STORE } from "@/lib/data";
import type { StaffRole, StoreMembershipDTO } from "@/lib/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertPermission, assertRole, staffToAccountContext } from "@/lib/authorization";
import type { Permission } from "@/lib/types";
import { getSessionState, updateSessionState } from "@/lib/session";

export async function getCurrentStaff() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ...LOCAL_STAFF, memberships: [{ storeId: STORE.id, storeSlug: STORE.slug, storeName: STORE.name, role: LOCAL_STAFF.role }] };

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const { data } = await supabase
    .from("store_memberships")
    .select("store_id, role, stores(slug,name), profiles(display_name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (!data?.length) return null;
  const memberships: StoreMembershipDTO[] = data.map((item) => ({
    storeId: item.store_id,
    role: item.role as StaffRole,
    storeSlug: (item.stores as { slug?: string } | null)?.slug,
    storeName: (item.stores as { name?: string } | null)?.name
  }));
  const session = await getSessionState();
  const activeMembership = memberships.find((item) => item.storeId === session.activeStoreId) ?? memberships[0];
  if (activeMembership.storeId !== session.activeStoreId) await updateSessionState({ activeStoreId: activeMembership.storeId });

  return {
    id: user.id,
    email: user.email ?? "",
    displayName: (data[0].profiles as { display_name?: string } | null)?.display_name ?? user.email ?? "Staff",
    role: activeMembership.role,
    storeId: activeMembership.storeId,
    memberships
  };
}

export async function requireStaff(roles?: StaffRole[]) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("Staff authentication required.");
  assertRole(staff, roles);
  return staff;
}

export async function requirePermission(permission: Permission, resource?: { tenantId?: string; storeId?: string; ownerUserId?: string; requiresAdultAccess?: boolean }) {
  const staff = await requireStaff();
  const context = staffToAccountContext(staff);
  assertPermission(context, permission, resource ?? { tenantId: staff.storeId, storeId: staff.storeId });
  return { staff, context };
}

export async function getCurrentStore() {
  const staff = await getCurrentStaff();
  const membership = staff?.memberships?.find((item) => item.storeId === staff.storeId);
  return { ...STORE, id: staff?.storeId ?? STORE.id, slug: membership?.storeSlug ?? STORE.slug, name: membership?.storeName ?? STORE.name };
}

export async function switchActiveStore(storeId: string) {
  const staff = await requireStaff();
  const membership = staff.memberships?.find((item) => item.storeId === storeId);
  if (!membership) throw new Error("Store access denied.");
  await updateSessionState({ activeStoreId: storeId, activeCartId: undefined });
  return storeId;
}
