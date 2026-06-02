import { describe, expect, it } from "vitest";
import { assertObjectStore, assertRole, assertStoreAccess } from "@/lib/authorization";
import type { StaffDTO } from "@/lib/types";

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

describe("authorization helpers", () => {
  it("denies broken object-level authorization across active stores", () => {
    expect(() => assertObjectStore(staff, "30000000-0000-4000-8000-000000000002")).toThrow(/different active store/);
  });

  it("denies non-member store access", () => {
    expect(() => assertStoreAccess(staff, "30000000-0000-4000-8000-000000000099")).toThrow(/denied/);
  });

  it("defaults role checks to deny when role is insufficient", () => {
    expect(() => assertRole(staff, ["admin"])).toThrow(/Insufficient/);
  });
});
