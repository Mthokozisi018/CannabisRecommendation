import { describe, expect, it } from "vitest";
import { assertObjectStore, assertPermission, assertRole, assertStoreAccess, canAccess, staffToAccountContext, visibleRolesForTenantPicker } from "@/lib/authorization";
import { visibleNavItems } from "@/lib/account-data";
import type { AccountContextDTO, StaffDTO } from "@/lib/types";

const staff: StaffDTO = {
  id: "staff-1",
  displayName: "Ava",
  email: "ava@example.test",
  role: "receptionist",
  storeId: "30000000-0000-4000-8000-000000000001",
  memberships: [
    { storeId: "30000000-0000-4000-8000-000000000001", role: "receptionist" },
    { storeId: "30000000-0000-4000-8000-000000000002", role: "catalog_manager" }
  ]
};

const customer: AccountContextDTO = {
  userId: "customer-1",
  tenantId: "tenant-1",
  storeId: "store-1",
  jurisdiction: "ZA",
  accountState: "active",
  ageVerificationStatus: "verified_adult",
  assignments: [{ role: "customer", scope: "self" }]
};

describe("authorization helpers", () => {
  it("denies broken object-level authorization across active stores", () => {
    expect(() => assertObjectStore(staff, "30000000-0000-4000-8000-000000000002")).toThrow(/different active store/);
  });

  it("denies non-member store access", () => {
    expect(() => assertStoreAccess(staff, "30000000-0000-4000-8000-000000000099")).toThrow(/denied/);
  });

  it("keeps legacy role checks default denied", () => {
    expect(() => assertRole(staff, ["admin"])).toThrow(/Insufficient/);
  });

  it("allows receptionist workflow but denies inventory management in the active store", () => {
    const context = staffToAccountContext(staff);
    expect(canAccess(context, "recommendation.start", { storeId: staff.storeId, tenantId: staff.storeId })).toBe(true);
    expect(canAccess(context, "inventory.manage.store", { storeId: staff.storeId, tenantId: staff.storeId })).toBe(false);
  });

  it("enforces customer self-only access", () => {
    expect(canAccess(customer, "privacy.manage_self", { ownerUserId: "customer-1" })).toBe(true);
    expect(canAccess(customer, "privacy.manage_self", { ownerUserId: "customer-2" })).toBe(false);
  });

  it("requires verified adult access for adult customer content", () => {
    expect(canAccess(customer, "customer.history.self", { ownerUserId: "customer-1", restrictionClass: "adult_customer", requiresAdultAccess: true })).toBe(true);
    expect(canAccess({ ...customer, ageVerificationStatus: "pending" }, "customer.history.self", { ownerUserId: "customer-1", restrictionClass: "adult_customer", requiresAdultAccess: true })).toBe(false);
  });

  it("denies suspended accounts except low-risk account recovery surfaces", () => {
    expect(() => assertPermission({ ...customer, accountState: "suspended" }, "customer.history.self", { ownerUserId: "customer-1" })).toThrow(/Insufficient/);
    expect(canAccess({ ...customer, accountState: "suspended" }, "account.security.manage", { ownerUserId: "customer-1" })).toBe(true);
  });

  it("hides platform super admin from tenant role pickers", () => {
    expect(visibleRolesForTenantPicker()).not.toContain("platform_super_admin");
  });

  it("filters navbar items by role permission", () => {
    const labels = visibleNavItems(staffToAccountContext(staff)).map((item) => item.label);
    expect(labels).toContain("Dashboard");
    expect(labels).not.toContain("Role Management");
  });
});
