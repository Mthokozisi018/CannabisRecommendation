import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
vi.mock("server-only", () => ({}));

const authGetClaims = vi.hoisted(() => vi.fn());

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({ auth: { getClaims: authGetClaims } }))
}));

type RefreshSession = typeof import("@/lib/supabase/proxy").refreshSupabaseSession;
let refreshSupabaseSession: RefreshSession;
let workstationProxy: typeof import("@/proxy").proxy;

beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://sessiontestref.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-test-key");
  ({ refreshSupabaseSession } = await import("@/lib/supabase/proxy"));
  ({ proxy: workstationProxy } = await import("@/proxy"));
});

beforeEach(() => {
  authGetClaims.mockReset();
});

function requestWithCookies(cookie: string) {
  return new NextRequest("https://greenchoice.example/dashboard/manager", {
    headers: { cookie }
  });
}

describe("Supabase request-boundary session handling", () => {
  it("rejects a forged dashboard cookie at the running request boundary", async () => {
    authGetClaims.mockResolvedValue({ data: null, error: Object.assign(new Error("bad jwt"), { code: "bad_jwt" }) });
    const response = await workstationProxy(requestWithCookies("sb-sessiontestref-auth-token=forged"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login?error=session-expired");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.cookies.get("sb-sessiontestref-auth-token")?.maxAge).toBe(0);
  });

  it("fails closed on an Auth outage while preserving a possibly valid session", async () => {
    authGetClaims.mockRejectedValue(Object.assign(new Error("upstream unavailable"), { status: 503 }));
    const response = await workstationProxy(requestWithCookies("sb-sessiontestref-auth-token=existing"));
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("5");
    expect(response.cookies.get("sb-sessiontestref-auth-token")).toBeUndefined();
  });

  it("accepts verified claims without deleting session cookies", async () => {
    authGetClaims.mockResolvedValue({ data: { claims: { sub: "staff-user" } }, error: null });
    const request = requestWithCookies("sb-sessiontestref-auth-token=valid");

    const result = await refreshSupabaseSession(request, () => NextResponse.next());

    expect(result.authenticated).toBe(true);
    expect(result.status).toBe("authenticated");
    expect(result.configured).toBe(true);
    expect(result.response.cookies.get("sb-sessiontestref-auth-token")).toBeUndefined();
  });

  it("clears stale base and chunked session cookies after failed verification", async () => {
    authGetClaims.mockResolvedValue({ data: null, error: new Error("invalid refresh token") });
    const request = requestWithCookies(
      "sb-sessiontestref-auth-token=stale; sb-sessiontestref-auth-token.0=stale-part; sb-sessiontestref-auth-token-code-verifier=keep"
    );

    const result = await refreshSupabaseSession(request, () => NextResponse.next());

    expect(result.authenticated).toBe(false);
    expect(result.status).toBe("unauthenticated");
    expect(result.reason).toBe("invalid_session");
    expect(result.response.cookies.get("sb-sessiontestref-auth-token")?.value).toBe("");
    expect(result.response.cookies.get("sb-sessiontestref-auth-token.0")?.value).toBe("");
    expect(result.response.cookies.get("sb-sessiontestref-auth-token-code-verifier")).toBeUndefined();
    expect(request.cookies.get("sb-sessiontestref-auth-token")).toBeUndefined();
  });

  it("keeps session cookies when auth refresh is temporarily unavailable", async () => {
    authGetClaims.mockRejectedValue(Object.assign(new Error("Gateway Timeout"), { status: 504 }));
    const request = requestWithCookies("sb-sessiontestref-auth-token=maybe-valid");

    const result = await refreshSupabaseSession(request, () => NextResponse.next());

    expect(result.authenticated).toBe(false);
    expect(result.status).toBe("unavailable");
    expect(result.reason).toBe("temporary_service_failure");
    expect(result.response.cookies.get("sb-sessiontestref-auth-token")).toBeUndefined();
    expect(request.cookies.get("sb-sessiontestref-auth-token")?.value).toBe("maybe-valid");
  });

  it("does not retry a failed token verification", async () => {
    authGetClaims.mockRejectedValue(new Error("refresh unavailable"));
    const request = requestWithCookies("sb-sessiontestref-auth-token=stale");

    const result = await refreshSupabaseSession(request, () => NextResponse.next());

    expect(result.authenticated).toBe(false);
    expect(result.status).toBe("unavailable");
    expect(authGetClaims).toHaveBeenCalledTimes(1);
  });
});
