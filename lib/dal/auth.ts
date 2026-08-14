import "server-only";
import { cache } from "react";
import { STORE } from "@/lib/data";
import { assertPermission, assertRole, staffToAccountContext } from "@/lib/authorization";
import { auditAccessDenied, decideDashboardAccess, getDashboardSession } from "@/lib/dashboard-session";
import { updateSessionState } from "@/lib/session";
import type { CurrentStaffUser } from "@/lib/staff-profile";
import type { Permission, StaffRole } from "@/lib/types";

export async function getCurrentStaff() {
  const session = await getDashboardSession();
  return session?.staff ?? null;
}

export async function getCurrentStaffUser(): Promise<CurrentStaffUser | null> {
  const session = await getDashboardSession();
  if (!session) return null;

  return {
    authUserId: session.profile.user_id ?? session.authUserId,
    email: session.email,
    fullName: session.displayName,
    role: session.profile.role,
    isActive: session.accountStatus === "active"
  };
}

export async function requireStaff(roles?: StaffRole[]) {
  const session = await getDashboardSession();
  if (!session) throw new Error("Staff authentication required.");
  const decision = decideDashboardAccess(session.profile);
  if (!decision.allowed) {
    await auditAccessDenied(session, "restricted_server_action_attempt", decision.reason);
    throw new Error(decision.message);
  }
  const staff = session.staff;
  assertRole(staff, roles);
  if (staff.role !== "admin" && !staff.storeId) {
    throw new Error("Staff store assignment is required before accessing store data.");
  }
  return staff;
}

export async function requirePermission(permission: Permission, resource?: { tenantId?: string; storeId?: string; ownerUserId?: string; requiresAdultAccess?: boolean }) {
  const staff = await requireStaff();
  const context = staffToAccountContext(staff);
  assertPermission(context, permission, resource ?? { tenantId: staff.storeId, storeId: staff.storeId });
  return { staff, context };
}

const getCurrentStoreCached = cache(async () => {
  const staff = await getCurrentStaff();
  const membership = staff?.memberships?.find((item) => item.storeId === staff.storeId);
  if (staff && staff.role !== "admin" && !staff.storeId) {
    return { ...STORE, id: "", slug: "unassigned", name: "Store setup required", accessStatus: "restricted" as const };
  }
  return {
    ...STORE,
    id: staff?.storeId ?? STORE.id,
    slug: membership?.storeSlug ?? STORE.slug,
    name: membership?.storeName ?? STORE.name,
    accessStatus: membership?.storeAccessStatus ?? (staff?.role === "admin" ? "active" : "restricted")
  };
});

export async function getCurrentStore() {
  return getCurrentStoreCached();
}

export async function switchActiveStore(storeId: string) {
  const staff = await requireStaff();
  const membership = staff.memberships?.find((item) => item.storeId === storeId);
  if (!membership) throw new Error("Store access denied.");
  await updateSessionState({ activeStoreId: storeId, activeCartId: undefined });
  return storeId;
}
