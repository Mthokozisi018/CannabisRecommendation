import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("critical repository security contracts", () => {
  it("requires the exact authenticated invitation identity and transactional completion", () => {
    const action = source("app/staff/invitation/actions.ts");
    const gate = source("components/staff/StaffInvitationSessionGate.tsx");
    const page = source("app/staff/invitation/onboarding/page.tsx");
    const migration = source("supabase/migrations/20260729120000_critical_authorization_hardening.sql");

    expect(action).toContain("supabase.auth.getUser()");
    expect(action).toContain("invitation.auth_user_id !== user.id");
    expect(action).toContain("metadataInvitationId !== parsed.invitationId");
    expect(gate).toContain("staff_invitation_id !== invitationId");
    expect(page).toContain("invitation.auth_user_id === userId");
    expect(page).toContain("invitation.email.toLowerCase() === userEmail.toLowerCase()");
    expect(page).toContain("manager.store_id !== invitation.store_id");
    expect(migration).toContain("invitation_row.auth_user_id is distinct from caller_id");
    expect(migration).toContain("invitation_row.completed_at is not null");
    expect(migration).toContain("invitation_row.store_id");
    expect(migration).toContain("invitation_row.invited_by");
    expect(migration).toContain("where id = p_invitation_id");
    expect(migration).toContain("for update");
  });

  it("keeps manager invitations bound to the invited auth user and manager setup scope", () => {
    const adminActions = source("app/dashboard/admin/actions.ts");
    const statusRoute = source("app/api/manager/invitation/status/route.ts");
    const completionRoute = source("app/api/manager/invitation/create-password/route.ts");
    const migration = source("supabase/migrations/20260729123000_secure_manager_invitation_completion.sql");

    expect(adminActions).toContain('data: { invited_role: "manager", invitation_id: invitationId }');
    expect(adminActions).toContain(".eq(\"status\", \"pending\")");
    expect(statusRoute).toContain('user.user_metadata?.invited_role !== "manager"');
    expect(statusRoute).toContain("user.user_metadata?.invitation_id !== invitationId.data");
    expect(statusRoute).toContain(".eq(\"auth_user_id\", user.id)");
    expect(completionRoute).toContain("metadataInvitationId !== parsed.data.invitationId");
    expect(completionRoute).toContain('user.user_metadata?.invited_role !== "manager"');
    expect(migration).toContain("v_invitation.auth_user_id is distinct from v_user_id");
    expect(migration).toContain("lower(v_invitation.email) <> v_user_email");
    expect(migration).toContain("auth.jwt() -> 'user_metadata' ->> 'invitation_id'");
    expect(migration).toContain("on conflict (auth_user_id) do update");
  });

  it("binds checkout to trusted server identity and revokes the obsolete RPC", () => {
    const action = source("app/dashboard/receptionist/actions.ts");
    const migration = source("supabase/migrations/20260729120000_critical_authorization_hardening.sql");

    expect(action).toContain("p_auth_user_id: staff.id");
    expect(action).toContain('rpc("complete_receptionist_sale_v2"');
    expect(migration).toContain("where coalesce(sp.auth_user_id, sp.user_id) = p_auth_user_id");
    expect(migration).toContain("grant execute on function public.complete_receptionist_sale_v2(uuid, uuid, jsonb) to service_role");
    expect(migration).toContain("revoke all on function public.complete_receptionist_sale(uuid, uuid, jsonb)");
    expect(migration).toContain("pg_advisory_xact_lock(hashtextextended(p_checkout_id::text, 0))");
  });

  it("preserves restricted store state during manager registration", () => {
    const onboarding = source("lib/manager/onboarding.ts");
    const migration = source("supabase/migrations/20260729120000_critical_authorization_hardening.sql");

    expect(onboarding).toContain("store_access_status");
    expect(onboarding).toContain('redirect("/dashboard/restricted/manager" as never)');
    expect(migration).toContain("resolved_status := coalesce(");
    expect(migration).toContain("manager_store_registration_preserved_restriction");
  });

  it("guards the full admin route tree and disables request-time provisioning", () => {
    expect(source("app/dashboard/admin/layout.tsx")).toContain("await requireAdmin()");
    expect(source("lib/admin-auth.ts")).toContain('session.profile.role !== "admin"');
    expect(source("app/api/auth/ensure-admin-profile/route.ts")).toContain("status: 410");
    expect(source("app/api/auth/ensure-admin-profile/route.ts")).not.toContain(".upsert(");
  });

  it("enforces private dashboard caching and nonce-based browser protections", () => {
    const proxy = source("proxy.ts");
    expect(proxy).toContain('"Content-Security-Policy"');
    expect(proxy).toContain("contentSecurityPolicy(nonce)");
    expect(proxy).toContain('"frame-ancestors \'none\'"');
    expect(proxy).toContain('"Cache-Control", "private, no-store, max-age=0"');
    expect(proxy).toContain("Cookie,Authorization");
    expect(proxy).not.toContain('"unsafe-eval"');
  });

  it("fails closed for missing origins, production URLs, secrets, and rate-limit storage", () => {
    expect(source("lib/security.ts")).toContain('if (!origin) throw new Error("Request origin is required.")');
    expect(source("lib/app-url.ts")).toContain("The production application URL is not configured");
    expect(source("lib/environment.ts")).toContain("RATE_LIMIT_REDIS_REST_URL");
    expect(source("lib/rate-limit.ts")).toContain('admin.rpc("consume_request_rate_limit"');
    expect(source("lib/rate-limit.ts")).toContain("if (!admin) throw new RateLimitUnavailableError()");
    const fallbackMigration = source("supabase/migrations/20260814135000_add_database_rate_limit_fallback.sql");
    expect(fallbackMigration).toContain("security definer");
    expect(fallbackMigration).toContain("set search_path = pg_catalog, public");
    expect(fallbackMigration).toContain("to service_role");
    expect(fallbackMigration).toContain("from public, anon, authenticated");
  });

  it("keeps manager audit scope server-derived and reactivation slot checks database-authoritative", () => {
    const actions = source("app/dashboard/manager/actions.ts");
    const migration = source("supabase/migrations/20260729129000_atomic_receptionist_status_and_slot_enforcement.sql");

    expect(actions).toContain('requireAssignedStoreId(profile, "Manager")');
    expect(actions).toContain('rpc("update_receptionist_account_status"');
    expect(migration).toContain("perform 1");
    expect(migration).toContain("for update");
    expect(migration).toContain("v_used_slots >= 5");
    expect(migration).toContain("denial_reason := 'receptionist_slot_limit_reached'");
  });
});
