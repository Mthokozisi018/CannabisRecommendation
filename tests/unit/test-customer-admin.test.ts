import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("admin test customer controls", () => {
  it("adds a dedicated server-managed test-account marker", () => {
    const migration = source("supabase/migrations/20260817104106_add_customer_test_account_marker.sql");

    expect(migration).toContain("add column if not exists is_test_account boolean not null default false");
    const followup = source("supabase/migrations/20261006072152_consolidated_security_followup.sql");
    expect(followup).toContain("customer_profiles_test_account_idx");
    expect(followup).toContain("where is_test_account = true");
    expect(migration).not.toContain("grant select");
    expect(migration).not.toContain("grant update");
  });

  it("keeps creation and reset admin-only, configured, and password-safe", () => {
    const actions = source("app/dashboard/admin/test-customer/actions.ts");
    const model = source("lib/admin/test-customer.ts");
    const controls = source("components/admin/TestCustomerControls.tsx");

    expect(actions).toContain("await requireAdminUser()");
    expect(actions).toContain("await verifyOrigin()");
    expect(actions).toContain("assertRateLimit");
    expect(model).toContain("GREENCHOICE_TEST_CUSTOMER_EMAIL");
    expect(model).toContain("GREENCHOICE_TEST_CUSTOMER_PASSWORD");
    expect(model).toContain("passwordLogged: false");
    expect(model).not.toContain("NEXT_PUBLIC_GREENCHOICE_TEST_CUSTOMER_PASSWORD");
    expect(controls).not.toContain('name="customerId"');
    expect(controls).not.toContain('name="userId"');
  });

  it("derives reset targets from the marked configured profile and preserves core identity", () => {
    const model = source("lib/admin/test-customer.ts");

    expect(model).toContain("requireConfiguredMarkedTestProfile");
    expect(model).toContain("profile.is_test_account !== true");
    expect(model).toContain(".eq(\"email\", email)");
    expect(model).toContain(".eq(\"created_by_user_id\", userId)");
    expect(model).toContain(".from(\"customer_favourites\").delete().eq(\"user_id\", userId)");
    expect(model).toContain(".from(\"customer_support_requests\").delete().eq(\"user_id\", userId)");
    expect(model).toContain(".from(\"customer_preferences\").upsert");
    expect(model).toContain("preservedAuthUser: true");
    expect(model).not.toContain("deleteUser");
    expect(model).not.toContain("customer_profiles\").delete()");
  });

  it("preserves the protected utility route without showing it on the main dashboard", () => {
    expect(existsSync(resolve(process.cwd(), "app/dashboard/admin/test-customer/page.tsx"))).toBe(true);
    expect(source("app/dashboard/admin/layout.tsx")).toContain("await requireAdmin()");
    expect(source("components/admin/AdminDashboardUI.tsx")).not.toContain("/dashboard/admin/test-customer");
  });
});
