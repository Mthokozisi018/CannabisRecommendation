import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("authentication and dashboard performance contracts", () => {
  it("refreshes Supabase cookies once at the request boundary with verified claims", () => {
    const proxy = source("proxy.ts");
    const supabaseProxy = source("lib/supabase/proxy.ts");

    expect(proxy).toContain("refreshSupabaseSession");
    expect(proxy).toContain("nextResponseWithSession");
    expect(supabaseProxy).toContain("supabase.auth.getClaims()");
    expect(supabaseProxy).not.toContain("supabase.auth.getUser()");
    expect(supabaseProxy).toContain("request.cookies.set");
    expect(supabaseProxy).toContain("response.cookies.set");
  });

  it("uses locally verifiable claims instead of a remote Auth user lookup for dashboard reads", () => {
    const dashboardSession = source("lib/dashboard-session.ts");

    expect(dashboardSession).toContain("supabase.auth.getClaims()");
    expect(dashboardSession).not.toContain("supabase.auth.getUser()");
    expect(dashboardSession).toContain('.eq("auth_user_id", user.id)');
    expect(dashboardSession).toContain("decideDashboardAccess(session.profile)");
  });

  it("reuses the client that completed password authentication", () => {
    const login = source("app/api/auth/login/route.ts");
    expect(login).toContain("getDashboardSessionForVerifiedUser(data.user, supabase)");
    expect(login).toContain("decideDashboardAccess");
    expect(login).toContain("supabase.auth.signOut()");
  });

  it("keeps hidden top-bar work and static assets out of protected request paths", () => {
    const topBar = source("components/TopBar.tsx");
    const proxy = source("proxy.ts");

    expect(topBar.indexOf("shouldRenderGlobalTopBar")).toBeLessThan(topBar.indexOf("getCurrentStaff()"));
    expect(proxy).toContain("images/");
    expect(proxy).toContain("placeholder-images/");
    expect(proxy).toContain(".*\\\\.(?:png|jpg|jpeg|webp|svg|gif|ico|pdf|css|js|map|txt)$");
  });

  it("accepts exact Vercel preview origins without weakening production origin checks", () => {
    const security = source("lib/security.ts");

    expect(security).toContain('process.env.VERCEL_ENV !== "preview"');
    expect(security).toContain("process.env.VERCEL_URL");
    expect(security).toContain("process.env.VERCEL_BRANCH_URL");
    expect(security).toContain('previewUrl.hostname.endsWith(".vercel.app")');
    expect(security).toContain('new Set(configured).has(normalizedOrigin)');
  });
});
