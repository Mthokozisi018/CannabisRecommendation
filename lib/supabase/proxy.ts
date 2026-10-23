import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { classifySupabaseAuthSessionError, safeErrorName } from "@/lib/auth-errors";
import { AUTH_BOUNDARY_FETCH_TIMEOUT_MS, createSupabaseFetch } from "@/lib/supabase/fetch";
import { supabaseSessionCookieBaseName, supabaseSessionCookieNames } from "@/lib/supabase/session-cookies";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const authBoundaryFetch = createSupabaseFetch(AUTH_BOUNDARY_FETCH_TIMEOUT_MS);

export type SupabaseSessionRefresh = {
  authenticated: boolean;
  configured: boolean;
  response: NextResponse;
  status: "authenticated" | "unauthenticated" | "unavailable";
  reason?: "missing_session" | "invalid_session" | "temporary_service_failure";
};

function sessionCookieBaseName() {
  return supabaseSessionCookieBaseName(url);
}

function sessionCookieNames(request: NextRequest) {
  return supabaseSessionCookieNames(request.cookies.getAll(), url);
}

function clearSessionCookies(request: NextRequest, response: NextResponse, names: string[]) {
  for (const name of names) {
    request.cookies.delete(name);
    response.cookies.set(name, "", {
      expires: new Date(0),
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    });
  }
}

function logSessionRefreshEvent(request: NextRequest, level: "warn" | "error", event: string, context: Record<string, unknown> = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    requestId: request.headers.get("x-request-id")?.slice(0, 120) ?? null,
    environment: process.env.GREENCHOICE_ENV ?? process.env.NODE_ENV ?? "unknown",
    route: request.nextUrl.pathname,
    context
  };
  if (level === "error") console.error(JSON.stringify(payload));
  else console.warn(JSON.stringify(payload));
}

export async function refreshSupabaseSession(request: NextRequest, createResponse: () => NextResponse): Promise<SupabaseSessionRefresh> {
  let response = createResponse();
  if (!url || !publishableKey) return { authenticated: false, configured: false, response, status: "unauthenticated", reason: "missing_session" };

  const existingSessionCookies = sessionCookieNames(request);
  const supabase = createServerClient(url, publishableKey, {
    cookieOptions: { sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" },
    global: {
      fetch: authBoundaryFetch
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(items) {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = createResponse();
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });

  try {
    // getClaims verifies the access token and only refreshes when it is near
    // expiry. With asymmetric signing it avoids a remote Auth request on the
    // common path, while still treating cookies as untrusted input.
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims.sub) {
      if (error) {
        const category = classifySupabaseAuthSessionError(error);
        if (category === "temporary_service_failure" || category === "unknown") {
          logSessionRefreshEvent(request, "warn", "session_refresh_failed", {
            failureCategory: category,
            errorName: safeErrorName(error),
            hasSessionCookies: existingSessionCookies.length > 0
          });
          return { authenticated: false, configured: true, response, status: "unavailable", reason: "temporary_service_failure" };
        }
      }
      if (existingSessionCookies.length) clearSessionCookies(request, response, existingSessionCookies);
      if (existingSessionCookies.length) {
        logSessionRefreshEvent(request, "warn", "invalid_session_cleared", {
          cookieCount: existingSessionCookies.length,
          baseCookieName: sessionCookieBaseName()
        });
      }
      return { authenticated: false, configured: true, response, status: "unauthenticated", reason: existingSessionCookies.length ? "invalid_session" : "missing_session" };
    }
    return { authenticated: true, configured: true, response, status: "authenticated" };
  } catch (error) {
    const category = classifySupabaseAuthSessionError(error);
    if (category === "invalid_session") {
      if (existingSessionCookies.length) clearSessionCookies(request, response, existingSessionCookies);
      logSessionRefreshEvent(request, "warn", "invalid_session_cleared", {
        cookieCount: existingSessionCookies.length,
        baseCookieName: sessionCookieBaseName()
      });
      return { authenticated: false, configured: true, response, status: "unauthenticated", reason: "invalid_session" };
    }

    logSessionRefreshEvent(request, "warn", "session_refresh_failed", {
      failureCategory: category,
      errorName: safeErrorName(error),
      hasSessionCookies: existingSessionCookies.length > 0
    });
    return { authenticated: false, configured: true, response, status: "unavailable", reason: "temporary_service_failure" };
  }
}
