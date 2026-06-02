import type { StaffDTO, StaffRole } from "@/lib/types";

export function assertRole(staff: StaffDTO, roles?: StaffRole[]) {
  if (roles && !roles.includes(staff.role)) throw new Error("Insufficient staff role.");
}

export function assertStoreAccess(staff: StaffDTO, storeId: string) {
  const memberships = staff.memberships ?? [{ storeId: staff.storeId, role: staff.role }];
  if (!memberships.some((membership) => membership.storeId === storeId)) {
    throw new Error("Store access denied.");
  }
}

export function assertObjectStore(staff: StaffDTO, objectStoreId: string) {
  assertStoreAccess(staff, objectStoreId);
  if (staff.storeId !== objectStoreId) throw new Error("Object belongs to a different active store.");
}
