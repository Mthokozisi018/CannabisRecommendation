import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AccountLookupUnavailableError, AuthDependencyUnavailableError } from "@/lib/auth-errors";
import { franchiseLoginDestination, managerLoginDestination, receptionistLoginDestination } from "@/lib/account-flow";
import { getCustomerSessionForVerifiedUser } from "@/lib/customer/auth";
import { decideDashboardAccess, getDashboardSessionForVerifiedUser } from "@/lib/dashboard-session";
import { isCustomerExperienceEnabled } from "@/lib/feature-flags";
import { logServerEvent, reportServerException } from "@/lib/logger";
import { RequestOriginError, verifyOrigin } from "@/lib/security";
import { RateLimitExceededError, rateLimitHeaders, requireRateLimit, trustedClientIp } from "@/lib/rate-limit";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(1).max(1024)
}).strict();

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Vary": "Cookie, Authorization"
};

function durationMs(startedAt: number) {
  return Math.round(performance.now() - startedAt);
}

async function signOutFreshLoginSession(supabase: SupabaseClient, context: Record<string, unknown>) {
  try {
    const { error } = await supabase.auth.signOut();
    if (!error) return;
    await logServerEvent("warn", "login_signout_failed", {
      ...context,
      failureCategory: "session_cleanup_failed"
    });
  } catch {
    await logServerEvent("warn", "login_signout_failed", {
      ...context,
      failureCategory: "session_cleanup_failed"
    });
  }
}

function loginDependencyFailureResponse(error: AccountLookupUnavailableError | AuthDependencyUnavailableError, startedAt: number) {
  const event = error instanceof AccountLookupUnavailableError
    ? "account_lookup_unavailable"
    : "supabase_temporarily_unavailable";
  return {
    event,
    response: NextResponse.json({
      error: "GreenChoice is temporarily unable to load your account details. Please try again."
    }, { status: 503, headers: privateHeaders }),
    context: {
      failureCategory: error.category,
      stage: error instanceof AccountLookupUnavailableError ? error.stage : error.dependency,
      temporary: error instanceof AccountLookupUnavailableError ? error.temporary : true,
      durationMs: durationMs(startedAt)
    }
  };
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  try {
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return NextResponse.json({ error: "Invalid request." }, { status: 415, headers: privateHeaders });
    }
    await verifyOrigin();
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request." }, { status: 400, headers: privateHeaders });
    }
    const parsed = loginSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 400, headers: privateHeaders });
    }

    await requireRateLimit({ namespace: "login", identifiers: [trustedClientIp(request.headers)], limit: 30, windowMs: 15 * 60_000, localFallbackWhenConfiguredProviderFails: process.env.NODE_ENV !== "production" });
    const supabase = await createSupabaseServerClient({ clearExistingSessionCookies: true });
    if (!supabase) {
      return NextResponse.json({ error: "Authentication is temporarily unavailable." }, { status: 503, headers: privateHeaders });
    }
    await logServerEvent("info", "login_started", { route: "/api/auth/login" });
    const authStartedAt = performance.now();
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error || !data.user) {
      await logServerEvent("warn", "login_failed", { reason: "invalid_credentials" });
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401, headers: privateHeaders });
    }
    await logServerEvent("info", "login_supabase_session_created", { authUserId: data.user.id, durationMs: durationMs(authStartedAt) });

    // The workstation profile is the first lookup because it is the shipping
    // path. Customer lookup is only needed for non-staff accounts.
    const roleStartedAt = performance.now();
    const session = await getDashboardSessionForVerifiedUser(data.user, supabase);
    if (!session) {
      const customerSession = isCustomerExperienceEnabled() ? await getCustomerSessionForVerifiedUser(data.user, supabase) : null;
      if (customerSession) {
        if (!isCustomerExperienceEnabled()) {
          await signOutFreshLoginSession(supabase, { reason: "customer_experience_disabled" });
          await logServerEvent("warn", "login_access_denied", { reason: "customer_experience_disabled" });
          return NextResponse.json({ error: "Customer access is not available." }, { status: 403, headers: privateHeaders });
        }
        if (customerSession.profile.status === "pending_verification") {
          return NextResponse.json({ error: "Verify your email address before signing in.", redirectTo: "/customer/verify-email" }, { status: 403, headers: privateHeaders });
        }
        if (customerSession.profile.status !== "active") {
          await signOutFreshLoginSession(supabase, { reason: "customer_account_unavailable" });
          return NextResponse.json({ error: "This customer account is currently unavailable." }, { status: 403, headers: privateHeaders });
        }
        await logServerEvent("info", "login_role_resolution_success", {
          authUserId: data.user.id,
          role: "customer",
          durationMs: durationMs(roleStartedAt)
        });
        return NextResponse.json({ authenticated: true, role: "customer", redirectTo: "/customer/shop" }, { headers: privateHeaders });
      }
      await signOutFreshLoginSession(supabase, { reason: "missing_profile" });
      await logServerEvent("warn", "login_access_denied", { reason: "missing_profile" });
      return NextResponse.json({ error: "This account has not been authorized for GreenChoice. Contact the administrator." }, {
        status: 403,
        headers: privateHeaders
      });
    }
    const decision = decideDashboardAccess(session.profile);
    if (!decision.allowed) {
      await signOutFreshLoginSession(supabase, { reason: decision.reason });
      await logServerEvent("warn", "login_access_denied", { reason: decision.reason });
      return NextResponse.json(
        { error: decision.message, reason: decision.reason, redirectTo: "/dashboard/restricted" },
        { status: 403, headers: privateHeaders }
      );
    }

    await logServerEvent("info", "login_role_resolution_success", {
      authUserId: session.authUserId,
      staffProfileId: session.staffProfileId,
      role: session.profile.role,
      storeId: session.assignedStoreId,
      durationMs: durationMs(roleStartedAt)
    });

    const admin = createSupabaseAdminClient();
    if (admin) {
      const { error: auditError } = await admin.from("audit_logs").insert({
        user_id: session.authUserId,
        action: "login_success",
        table_name: "auth_access",
        record_id: session.staffProfileId,
        store_id: session.assignedStoreId,
        result: "success",
        details: { ipAddress: trustedClientIp(request.headers), userAgent: request.headers.get("user-agent")?.slice(0, 512) ?? null, role: session.profile.role }
      });
      if (auditError) {
        await logServerEvent("warn", "login_audit_write_failed", {
          authUserId: session.authUserId,
          role: session.profile.role
        });
      }
    }

    const redirectTo = session.isAdmin
      ? "/dashboard/admin"
      : session.isManager
        ? managerLoginDestination(session)
        : session.profile.role === "franchise_admin" ? franchiseLoginDestination(session) : receptionistLoginDestination(session);

    await logServerEvent("info", "login_ready_for_redirect", {
      authUserId: session.authUserId,
      staffProfileId: session.staffProfileId,
      role: session.profile.role,
      redirectTo
    });

    return NextResponse.json({ authenticated: true, redirectTo }, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof RequestOriginError) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers: privateHeaders });
    }
    if (error instanceof RateLimitExceededError) {
      return NextResponse.json({ error: error.message }, { status: 429, headers: { ...privateHeaders, ...rateLimitHeaders(error.result) } });
    }
    if (error instanceof AccountLookupUnavailableError || error instanceof AuthDependencyUnavailableError) {
      const failure = loginDependencyFailureResponse(error, startedAt);
      await logServerEvent("warn", failure.event, failure.context);
      return failure.response;
    }
    await reportServerException("login_unavailable", error);
    return NextResponse.json({ error: "Authentication is temporarily unavailable." }, { status: 503, headers: privateHeaders });
  }
}
