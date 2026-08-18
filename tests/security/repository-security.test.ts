import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("critical repository security contracts", () => {
  it("creates receptionist accounts under the authenticated manager store lock", () => {
    const action = source("app/dashboard/manager/actions.ts");
    const setupAction = source("app/staff/setup/actions.ts");
    const migration = source("supabase/migrations/20260804140000_direct_receptionist_accounts.sql");

    expect(action).toContain("auth.admin.createUser");
    expect(action).toContain('greenchoice_role: "receptionist"');
    expect(action).toContain('greenchoice_registration: "manager_created"');
    expect(action).toContain('rpc("create_manager_receptionist_profile"');
    expect(action).toContain("deleteUnboundManagerCreatedReceptionist");
    expect(action).not.toContain("inviteUserByEmail");
    expect(setupAction).toContain("supabase.auth.updateUser");
    expect(setupAction).toContain('rpc("complete_manager_created_receptionist_setup"');
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("manager_profile.store_id");
    expect(migration).toContain("greenchoice_manager_id");
    expect(migration).toContain("occupied_slots >= 5");
    expect(migration).toContain("temporary_password_active = false");
    expect(migration).toContain("revoke all on function public.reserve_receptionist_invitation");
    expect(existsSync(resolve(process.cwd(), "app/staff/invitation/onboarding/page.tsx"))).toBe(false);
    expect(existsSync(resolve(process.cwd(), "components/staff/StaffInvitationSessionGate.tsx"))).toBe(false);
  });

  it("bootstraps only server-marked manual managers and retires manager invitation activation", () => {
    const registration = source("lib/manual-manager-registration.ts");
    const dashboardSession = source("lib/dashboard-session.ts");
    const migration = source("supabase/migrations/20260804120000_manual_manager_registration.sql");
    const emptyProfileMigration = source("supabase/migrations/20260804130000_empty_manual_manager_onboarding_profile.sql");
    const adminActions = source("app/dashboard/admin/actions.ts");

    expect(registration).toContain("user.app_metadata");
    expect(registration).not.toContain("user.user_metadata");
    expect(migration).toContain("auth_user.raw_app_meta_data ->> 'greenchoice_role'");
    expect(migration).toContain("auth_user.raw_app_meta_data ->> 'greenchoice_registration'");
    expect(migration).toContain("auth_user.email_confirmed_at is null");
    expect(migration).toContain("auth_user.banned_until");
    expect(migration).toContain("existing_profile.role <> 'manager'");
    expect(migration).toContain("sole_admin_count <> 1");
    expect(migration).toContain("temporary_password_active");
    expect(migration).toContain("manual_manager_profile_initialized");
    expect(emptyProfileMigration).toContain("full_name = null");
    expect(emptyProfileMigration).toContain("profile.auth_user_id = auth_user.id");
    expect(emptyProfileMigration).toContain("coalesce(auth_user.raw_app_meta_data ->> 'greenchoice_registration', '') = 'manual'");
    expect(emptyProfileMigration).toContain("null,\n    'manager'");
    expect(migration).toContain("revoke execute on function public.complete_manager_invitation(uuid) from authenticated");
    expect(dashboardSession).toContain("bootstrapManualManagerProfile");
    expect(source("app/api/auth/login/route.ts")).toContain("This account has not been authorized for GreenChoice");
    expect(adminActions).not.toContain("inviteUserByEmail");
    expect(existsSync(resolve(process.cwd(), "app/dashboard/admin/invite-manager/page.tsx"))).toBe(false);
    expect(existsSync(resolve(process.cwd(), "app/dashboard/admin/invitations/page.tsx"))).toBe(false);
    expect(existsSync(resolve(process.cwd(), "app/manager/invitation/set-password/page.tsx"))).toBe(false);
    expect(existsSync(resolve(process.cwd(), "app/api/manager/invitation/create-password/route.ts"))).toBe(false);
  });

  it("uses the authenticated manager session to replace the temporary password", () => {
    const action = source("app/manager/setup/actions.ts");
    const form = source("components/manager/ManagerOnboarding.tsx");
    const migration = source("supabase/migrations/20260804120000_manual_manager_registration.sql");
    const passwordUpdateIndex = action.indexOf("supabase.auth.updateUser");
    const completionIndex = action.indexOf('admin.rpc("complete_manual_manager_account_setup"');

    expect(action).not.toContain("currentTemporaryPassword");
    expect(action).not.toContain("supabase.auth.signInWithPassword");
    expect(form).not.toContain("Current Temporary Password");
    expect(form).not.toContain('name="currentTemporaryPassword"');
    expect(passwordUpdateIndex).toBeGreaterThan(-1);
    expect(completionIndex).toBeGreaterThan(passwordUpdateIndex);
    expect(action).toContain("Your secure sign-in session has expired");
    expect(migration).toContain("target_profile.temporary_password_active is not true");
    expect(migration).toContain("temporary_password_active = false");
    expect(migration).toContain("manual_manager_account_setup_completed");
  });

  it("keeps first-time manager account registration empty, compact, and actionable", () => {
    const onboarding = source("lib/manager/onboarding.ts");
    const form = source("components/manager/ManagerOnboarding.tsx");
    const accountPage = source("app/manager/setup/account/page.tsx");

    expect(onboarding).toContain("export function managerAccountInitialValues()");
    expect(onboarding).toContain('fullName: ""');
    expect(onboarding).toContain('physicalAddress: ""');
    expect(onboarding).toContain('.eq("auth_user_id", user.id)');
    expect(accountPage).toContain("managerAccountInitialValues()");
    expect(form).toContain('autoComplete="off"');
    expect(form).toContain("Step 1 of 3 · Account registration");
    expect(form).not.toContain("<aside");
    expect(form).not.toContain("!formValid || !legalDocuments.available");
    expect(form).toContain('role="alert"');
  });

  it("allows only the sole administrator to mark an existing Auth user for manager onboarding", () => {
    const action = source("app/dashboard/admin/actions.ts");
    const form = source("components/admin/ConnectManagerForm.tsx");

    expect(action).toContain("connectManualManagerAction");
    expect(action).toContain("await requireAdminUser()");
    expect(action).toContain("activeAdminIds.length !== 1");
    expect(action).toContain("auth.admin.listUsers");
    expect(action).toContain("auth.admin.updateUserById");
    expect(action).toContain("...existingMetadata");
    expect(action).toContain('greenchoice_role: "manager"');
    expect(action).toContain('greenchoice_registration: "manual"');
    expect(action).toContain("authUser.id === soleAdmin.id");
    expect(action).toContain("staff_profiles");
    expect(action).toContain("admin_authorized_manual_manager");
    expect(action).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(form).not.toContain("password");
  });

  it("keeps incomplete manager onboarding distinct from deliberate access restriction", () => {
    const accountFlow = source("lib/account-flow.ts");
    const loginRoute = source("app/api/auth/login/route.ts");
    const loginFormRoute = source("app/api/auth/login-form/route.ts");

    expect(accountFlow).toContain('profile.role === "manager" && !profile.store_id');
    expect(accountFlow).toContain('return "/manager/setup/account"');
    expect(accountFlow).toContain('return "/manager/setup/store"');
    expect(accountFlow).toContain('return "/manager/setup/complete"');
    expect(accountFlow).toContain('return "/dashboard/manager"');
    expect(loginRoute).toContain("managerLoginDestination(session)");
    expect(loginFormRoute).toContain("managerLoginDestination(session)");
    expect(loginRoute).toContain("receptionistLoginDestination(session)");
    expect(loginFormRoute).toContain("receptionistLoginDestination(session)");
    expect(accountFlow).not.toContain("Your password was changed successfully");
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
    const outputFix = source("supabase/migrations/20260804111000_fix_manager_store_registration_output.sql");

    expect(onboarding).toContain("store_access_status");
    expect(onboarding).toContain('redirect("/dashboard/restricted/manager" as never)');
    expect(migration).toContain("resolved_status := coalesce(");
    expect(migration).toContain("manager_store_registration_preserved_restriction");
    expect(outputFix).toContain("insert into public.stores as created_store");
    expect(outputFix).toContain("returning created_store.id, created_store.store_access_status");
    expect(outputFix).toContain("linked_store.created_by_manager_id <> caller_id");
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
    expect(source("lib/environment.ts")).toContain("UPSTASH_REDIS_REST_URL");
    expect(source("lib/rate-limit.ts")).toContain("if (process.env.NODE_ENV === \"production\") throw new RateLimitUnavailableError()");
  });

  it("grants only the server role the customer cart write privileges required by the API", () => {
    const baseMigration = source("supabase/migrations/20260602160000_greenchoice_mvp.sql");
    const customerMigration = source("supabase/migrations/20260814090000_customer_portal.sql");
    const serverGrantMigration = source("supabase/migrations/20260817150042_grant_customer_cart_server_access.sql");
    const cartRoute = source("app/api/customer/cart/route.ts");
    const cartReader = source("lib/customer/cart.ts");

    expect(baseMigration).toContain("alter table public.carts enable row level security");
    expect(baseMigration).toContain("alter table public.cart_items enable row level security");
    expect(customerMigration).toContain("grant select on public.carts, public.cart_items to authenticated");
    expect(customerMigration).not.toMatch(/grant\s+(?:select,\s*)?(?:insert|update|delete)[^;]*public\.carts[^;]*to authenticated/i);
    expect(customerMigration).not.toMatch(/grant\s+(?:select,\s*)?(?:insert|update|delete)[^;]*public\.cart_items[^;]*to authenticated/i);

    expect(serverGrantMigration).toContain("grant select, insert, update\n  on table public.carts\n  to service_role");
    expect(serverGrantMigration).toContain("grant select, insert, update, delete\n  on table public.cart_items\n  to service_role");
    expect(serverGrantMigration).not.toMatch(/grant\s+[^;]*delete[^;]*public\.carts/i);
    expect(serverGrantMigration).not.toMatch(/to anon/i);
    expect(serverGrantMigration).not.toMatch(/to authenticated/i);

    expect(cartReader).toContain("createSupabaseAdminClient()");
    expect(cartReader).toContain('.from("carts")');
    expect(cartRoute).toContain("createSupabaseAdminClient()");
    expect(cartRoute).toContain('.from("carts").insert');
    expect(cartRoute).toContain('.from("carts").update');
    expect(cartRoute).toContain('.from("cart_items").insert');
    expect(cartRoute).toContain('.from("cart_items").update');
    expect(cartRoute).toContain('.from("cart_items").delete');
  });

  it("keeps manager audit scope server-derived and reactivation slot checks database-authoritative", () => {
    const actions = source("app/dashboard/manager/actions.ts");
    const migration = source("supabase/migrations/20260804140000_direct_receptionist_accounts.sql");

    expect(actions).toContain('requireAssignedStoreId(profile, "Manager")');
    expect(actions).toContain('rpc("update_receptionist_account_status"');
    expect(migration).toContain("perform 1");
    expect(migration).toContain("for update");
    expect(migration).toContain("other_occupied_slots >= 5");
    expect(migration).toContain("denial_reason := 'receptionist_slot_limit_reached'");
  });
});
