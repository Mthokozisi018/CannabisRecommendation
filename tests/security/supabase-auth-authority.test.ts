import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Supabase Auth ownership contracts", () => {
  it("delegates password verification and recovery to Supabase without duplicate application throttles", () => {
    const login = source("app/api/auth/login/route.ts");
    const recovery = source("app/api/auth/password-recovery/route.ts");
    const update = source("app/api/auth/password-update/route.ts");

    expect(login).toContain("supabase.auth.signInWithPassword");
    expect(recovery).toContain("supabase.auth.resetPasswordForEmail");
    expect(update).toContain("supabase.auth.updateUser");
    for (const route of [login, recovery, update]) {
      expect(route).not.toContain("consumeRateLimit");
      expect(route).not.toContain("configuredRateLimit");
    }
  });

  it("keeps account and store access checks after Supabase authenticates a user", () => {
    const login = source("app/api/auth/login/route.ts");
    const update = source("app/api/auth/password-update/route.ts");
    expect(login).toContain("decideDashboardAccess");
    expect(login).toContain("supabase.auth.signOut()");
    expect(update).toContain("decideDashboardAccess");
    expect(update).toContain("password_reset_completed_restricted_account");
  });

  it("uses Supabase invitations and user-chosen passwords while GreenChoice assigns authorization", () => {
    const managerInvite = source("app/dashboard/admin/actions.ts");
    const receptionistInvite = source("app/dashboard/manager/actions.ts");
    const managerCompletion = source("app/api/manager/invitation/create-password/route.ts");
    const receptionistCompletion = source("app/staff/invitation/actions.ts");

    expect(managerInvite).toContain("auth.admin.inviteUserByEmail");
    expect(managerInvite).toContain("deleteUnboundManagerInviteAuthUser");
    expect(managerInvite).toContain("if (bindError) throw new Error(bindError.message)");
    expect(receptionistInvite).toContain("auth.admin.inviteUserByEmail");
    expect(receptionistInvite).toContain("deleteUnboundStaffInviteAuthUser");
    expect(receptionistInvite).toContain("if (bindError) throw new Error(bindError.message)");
    expect(managerCompletion).toContain("supabase.auth.updateUser");
    expect(managerCompletion).toContain('rpc("complete_manager_invitation"');
    expect(receptionistCompletion).toContain("supabase.auth.updateUser");
    expect(receptionistCompletion).toContain('rpc("complete_staff_onboarding"');
  });

  it("retains distributed limits on GreenChoice business actions", () => {
    expect(source("app/dashboard/receptionist/actions.ts")).toContain("assertRateLimit");
    expect(source("app/dashboard/manager/actions.ts")).toContain("assertRateLimit");
    expect(source("app/dashboard/admin/actions.ts")).toContain("assertRateLimit");
    expect(source("app/staff/invitation/actions.ts")).toContain("assertRateLimit");
  });

  it("keeps manager and receptionist onboarding bound to current Supabase users", () => {
    const managerOnboarding = source("lib/manager/onboarding.ts");
    const receptionistOnboarding = source("app/staff/invitation/actions.ts");
    expect(managerOnboarding).toContain("supabase.auth.getUser()");
    expect(managerOnboarding).toContain('redirect("/dashboard/restricted/manager" as never)');
    expect(receptionistOnboarding).toContain("invitation.auth_user_id !== user.id");
    expect(receptionistOnboarding).toContain("metadataInvitationId !== parsed.invitationId");
  });

  it("has no second server-side session table, cookie, heartbeat route, or validity guard", () => {
    expect(existsSync(resolve(process.cwd(), "lib/greenchoice-session.ts"))).toBe(false);
    expect(existsSync(resolve(process.cwd(), "app/api/auth/session/activity/route.ts"))).toBe(false);

    const repositorySources = [
      source("app/api/auth/login/route.ts"),
      source("lib/dashboard-session.ts"),
      source("lib/dal/auth.ts"),
      source("lib/manager/onboarding.ts"),
      source("supabase/migrations/20260729122000_atomic_inventory.sql")
    ].join("\n");
    expect(repositorySources).not.toContain("greenchoice_sessions");
    expect(repositorySources).not.toContain("greenchoice_activity_session");
    expect(repositorySources).not.toContain("requireGreenChoiceSession");
  });

  it("keeps the inactivity warning UI tied to genuine input and Supabase sign-out", () => {
    const monitor = source("components/SessionActivityMonitor.tsx");
    expect(monitor).toContain('"pointerdown", "keydown", "touchstart"');
    expect(monitor).toContain("supabase.auth.signOut()");
    expect(monitor).toContain("supabase.auth.onAuthStateChange");
    expect(monitor).not.toContain("/api/auth/session/activity");
  });

  it("does not amplify Auth requests from manager dashboard loading or form double-submits", () => {
    const managerSummary = source("lib/manager/dashboard-summary.ts");
    const managerLayout = source("app/dashboard/manager/layout.tsx");
    const managerActions = source("components/manager/ManagerDashboardActions.tsx");
    const managerPage = source("app/dashboard/manager/page.tsx");
    const managerData = source("lib/manager/data.ts");
    const cache = source("lib/cache/redis.ts");
    const loginForm = source("app/login/LoginForm.tsx");
    const recovery = source("app/forgot-password/page.tsx");

    expect(managerSummary).not.toContain("auth.admin.getUserById");
    expect(managerSummary).not.toContain("auth.admin.listUsers");
    expect(managerSummary).toContain('.eq("action", "login_success")');
    expect(managerLayout).not.toContain("ManagerRoutePrefetcher");
    expect(managerPage).toContain("ManagerPOSRoutePreloader");
    expect(managerActions).toContain("prefetch");
    expect(source("components/manager/ManagerPOSRoutePreloader.tsx")).toContain("MANAGER_FAST_ROUTES");
    expect(managerData).toContain("managerProductsCacheKey");
    expect(managerData).toContain("managerStaffAccountsCacheKey");
    expect(managerData).toContain("receptionistSlotUsageCacheKey");
    expect(cache).toContain("invalidateManagerStaffCache");
    expect(loginForm).toContain("submissionInFlightRef");
    expect(recovery).toContain("submissionInFlightRef");
  });

  it("relies on the login route access decision before leaving login", () => {
    const loginRoute = source("app/api/auth/login/route.ts");
    const loginForm = source("app/login/LoginForm.tsx");
    expect(loginRoute).toContain("decideDashboardAccess");
    expect(loginRoute).toContain("getDashboardSessionForVerifiedUser");
    expect(loginForm).toContain('fetch("/api/auth/login"');
    expect(loginForm).not.toContain('fetch("/api/auth/access-decision"');
    expect(loginForm).not.toContain("confirmServerSession");
    expect(loginForm).toContain('method="post"');
    expect(loginForm).toContain('action="/api/auth/login-form"');
    expect(loginForm).toContain("disabled={isSubmitting}");
    expect(loginForm).toContain("window.location.replace");
  });

  it("exchanges each recovery or invitation code only once per mounted flow", () => {
    const updatePassword = source("app/update-password/page.tsx");
    const managerInvitationPassword = source("app/manager/invitation/set-password/password-form.tsx");
    expect(updatePassword).toContain("exchangedCodeRef");
    expect(updatePassword).toContain("exchangePromiseRef");
    expect(updatePassword).toContain("await (exchangePromiseRef.current");
    expect(updatePassword).toContain('method="post"');
    expect(updatePassword).toContain("!isReady || isSubmitting");
    expect(source("components/staff/StaffInvitationSessionGate.tsx")).toContain("preparedInvitationRef");
    expect(managerInvitationPassword).toContain("verifiedInvitationRef");
    expect(managerInvitationPassword).toContain('method="post"');
    expect(managerInvitationPassword).toContain("!isReady || status === \"submitting\"");
  });
});
