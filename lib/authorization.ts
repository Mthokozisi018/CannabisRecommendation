import type { AccountContextDTO, AccountRole, Permission, ProductRestrictionClass, RoleAssignmentDTO, ScopeType, StaffDTO, StaffRole } from "@/lib/types";

export const tenantFacingRoles: AccountRole[] = [
  "customer",
  "employee_receptionist",
  "employee_budtender",
  "manager",
  "compliance_officer",
  "tenant_admin",
  "owner"
];

export const roleLabels: Record<AccountRole, string> = {
  guest: "Guest",
  customer: "Customer",
  employee_receptionist: "Receptionist",
  employee_budtender: "Budtender",
  manager: "Manager",
  compliance_officer: "Compliance Officer",
  tenant_admin: "Tenant Admin",
  owner: "Owner",
  platform_super_admin: "Platform Super Admin"
};

const rolePermissions: Record<AccountRole, Permission[]> = {
  guest: ["brand.view", "age_gate.complete", "account.register", "account.login"],
  customer: ["brand.view", "account.self.read", "account.self.update", "account.security.manage", "privacy.manage_self", "customer.history.self"],
  employee_receptionist: ["brand.view", "customer.intake.store", "customer.view.store", "recommendation.start", "appointments.manage.store", "orders.support.store", "catalog.view.store"],
  employee_budtender: ["brand.view", "customer.intake.store", "customer.view.store", "recommendation.start", "orders.support.store", "catalog.view.store", "inventory.view.store"],
  manager: ["brand.view", "customer.view.store", "appointments.manage.store", "orders.support.store", "catalog.view.store", "inventory.view.store", "inventory.manage.store", "reports.view.store", "team.manage.frontline"],
  compliance_officer: ["brand.view", "policy.manage.tenant", "audit.view.tenant", "consent.view.tenant", "privacy.requests.manage", "catalog.view.store"],
  tenant_admin: ["brand.view", "recommendation.start", "catalog.view.store", "inventory.view.store", "inventory.manage.store", "team.manage.tenant", "roles.manage.tenant", "settings.manage.tenant", "audit.view.tenant", "consent.view.tenant", "privacy.requests.manage", "exports.customer_data"],
  owner: ["brand.view", "reports.view.tenant", "finance.view.tenant", "settings.manage.tenant", "team.manage.tenant", "audit.view.tenant"],
  platform_super_admin: ["platform.admin"]
};

const legacyRoleMap: Record<"admin" | "receptionist" | "catalog_manager", AccountRole> = {
  admin: "tenant_admin",
  receptionist: "employee_receptionist",
  catalog_manager: "manager"
};

export type AuthorizationResource = {
  ownerUserId?: string;
  tenantId?: string;
  storeId?: string;
  restrictionClass?: ProductRestrictionClass;
  visibilityLevel?: ProductRestrictionClass;
  staffOnly?: boolean;
  requiresAdultAccess?: boolean;
};

export function normalizeRole(role: StaffRole): AccountRole {
  if (role === "admin" || role === "receptionist" || role === "catalog_manager") return legacyRoleMap[role];
  return role;
}

export function roleHasPermission(role: AccountRole, permission: Permission) {
  return rolePermissions[role]?.includes(permission) ?? false;
}

function assignmentCoversScope(assignment: RoleAssignmentDTO, context: AccountContextDTO, resource?: AuthorizationResource) {
  if (assignment.scope === "platform") return assignment.role === "platform_super_admin";
  if (assignment.scope === "tenant") return !resource?.tenantId || assignment.tenantId === resource.tenantId || assignment.tenantId === context.tenantId;
  if (assignment.scope === "store") {
    const storeId = resource?.storeId ?? context.storeId;
    return Boolean(storeId && assignment.storeId === storeId && (!resource?.tenantId || assignment.tenantId === resource.tenantId || assignment.tenantId === context.tenantId));
  }
  if (assignment.scope === "self") return Boolean(resource?.ownerUserId && resource.ownerUserId === context.userId);
  return false;
}

function accountAllowsAccess(context: AccountContextDTO, permission: Permission) {
  if (context.accountState !== "active") {
    return ["brand.view", "age_gate.complete", "account.login", "privacy.manage_self", "account.security.manage"].includes(permission);
  }
  return true;
}

function adultAccessSatisfied(context: AccountContextDTO, resource?: AuthorizationResource) {
  if (!resource?.requiresAdultAccess && resource?.restrictionClass !== "adult_customer") return true;
  return context.jurisdiction === "ZA" && context.ageVerificationStatus === "verified_adult";
}

function restrictionAllows(permission: Permission, resource?: AuthorizationResource) {
  const restriction = resource?.restrictionClass ?? resource?.visibilityLevel ?? "public_low_risk";
  if (restriction === "public_low_risk") return true;
  if (restriction === "adult_customer") return permission !== "brand.view";
  if (restriction === "staff_internal") return permission.includes(".store") || permission.includes(".tenant");
  if (restriction === "compliance_internal") return permission === "policy.manage.tenant" || permission === "audit.view.tenant" || permission === "consent.view.tenant";
  if (restriction === "prescription_or_medical_review_required") return permission === "policy.manage.tenant" || permission === "audit.view.tenant";
  return false;
}

export function canAccess(context: AccountContextDTO, permission: Permission, resource?: AuthorizationResource) {
  if (!accountAllowsAccess(context, permission)) return false;
  if (!adultAccessSatisfied(context, resource)) return false;
  if (!restrictionAllows(permission, resource)) return false;

  return context.assignments.some((assignment) => {
    if (!roleHasPermission(assignment.role, permission)) return false;
    if (assignment.role === "platform_super_admin") return assignment.scope === "platform";
    return assignmentCoversScope(assignment, context, resource);
  });
}

export function assertPermission(context: AccountContextDTO, permission: Permission, resource?: AuthorizationResource) {
  if (!canAccess(context, permission, resource)) throw new Error("Insufficient permission.");
}

export function staffToAccountContext(staff: StaffDTO): AccountContextDTO {
  return {
    userId: staff.id,
    tenantId: staff.storeId,
    storeId: staff.storeId,
    jurisdiction: "ZA",
    ageVerificationStatus: "verified_adult",
    accountState: "active",
    mfaEnabled: true,
    assignments: (staff.memberships ?? [{ storeId: staff.storeId, role: staff.role }]).map((membership) => {
      const role = normalizeRole(membership.role);
      return {
      role,
      scope: (role === "tenant_admin" || role === "owner" || role === "compliance_officer" ? "tenant" : "store") as ScopeType,
      tenantId: staff.storeId,
      storeId: membership.storeId
    };
    })
  };
}

export function assertRole(staff: StaffDTO, roles?: StaffRole[]) {
  if (roles && !roles.map(normalizeRole).includes(normalizeRole(staff.role))) throw new Error("Insufficient staff role.");
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

export function visibleRolesForTenantPicker() {
  return tenantFacingRoles;
}
