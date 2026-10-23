import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("manager store update security", () => {
  const migration = source("supabase/migrations/20260902100242_secure_manager_store_updates.sql");
  const action = source("app/dashboard/manager/store/actions.ts");

  it("derives the target store from auth.uid without accepting a store id", () => {
    expect(migration).toContain("v_caller_id uuid := auth.uid()");
    expect(migration).toContain("coalesce(sp.auth_user_id, sp.user_id) = v_caller_id");
    expect(migration).toContain("sp.role = 'manager'");
    expect(migration).toContain("where id = v_store_id");
    expect(migration).not.toMatch(/p_store_id\s+uuid/i);
    expect(action).not.toContain('formData.get("storeId")');
    expect(action).not.toContain("p_store_id");
  });

  it("keeps the privileged function narrow, audited, and unavailable to anonymous callers", () => {
    expect(migration).toContain("set search_path = pg_catalog, public");
    expect(migration).toContain("s.slug <> 'greenchoice-admin-demo-store'");
    expect(migration).toContain("'manager_updated_own_store'");
    expect(migration).toContain("revoke all on function public.update_own_manager_store(jsonb, jsonb) from public, anon, authenticated");
    expect(migration).toContain("grant execute on function public.update_own_manager_store(jsonb, jsonb) to authenticated");
    expect(migration).not.toMatch(/grant\s+(?:all|update)[^;]*public\.(?:stores|store_fulfillment_settings)[^;]*authenticated/i);
  });

  it("uses the authenticated server client and applies origin, role, and rate-limit checks", () => {
    expect(action).toContain("await verifyOrigin()");
    expect(action).toContain("await requireCompletedManagerDashboardSession()");
    expect(action).toContain("await assertRateLimit");
    expect(action).toContain("createSupabaseServerClient()");
    expect(action).toContain('.rpc("update_own_manager_store"');
    expect(action).toContain("Store updates are not installed in this database environment yet.");
    expect(action).not.toContain("createSupabaseAdminClient");
  });
});
