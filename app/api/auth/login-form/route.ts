import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AccountLookupUnavailableError, AuthDependencyUnavailableError } from "@/lib/auth-errors";
import { franchiseLoginDestination, managerLoginDestination, receptionistLoginDestination } from "@/lib/account-flow";
import { getCustomerSessionForVerifiedUser } from "@/lib/customer/auth";
import { decideDashboardAccess, getDashboardSessionForVerifiedUser, restrictedPathForSession } from "@/lib/dashboard-session";
import { isCustomerExperienceEnabled } from "@/lib/feature-flags";
import { logServerEvent, reportServerException } from "@/lib/logger";
import { RequestOriginError, verifyOrigin } from "@/lib/security";
import { RateLimitExceededError, rateLimitHeaders, requireRateLimit, trustedClientIp } from "@/lib/rate-limit";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { offerManagerWelcomeAtLogin } from "@/lib/manager/welcome";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(1).max(1024)
}).strict();

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Vary": "Cookie, Authorization"
};

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url), {
    status: 303,
    headers: privateHeaders
  });
}

function loginRedirectForError(request: Request, error: string) {
  return redirectTo(request, `/login?error=${encodeURIComponent(error)}`);
}

function durationMs(startedAt: number) {
  return Math.round(performance.now() - startedAt);
}

async function signOutFreshLoginSession(supabase: SupabaseClient, context: Record<string, unknown>) {
  try {
    const { error } = await supabase.auth.signOut();
    if (!error) return;
    await logServerEvent("warn", "login_signout_failed", {
      ...context,
      fallback: "form_post",
      failureCategory: "session_cleanup_failed"
    });
  } catch {
    await logServerEvent("warn", "login_signout_failed", {
      ...context,
      fallback: "form_post",
      failureCategory: "session_cleanup_failed"
    });
  }
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  try {
    await verifyOrigin();
    const formData = await request.formData();
    const parsed = loginSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password")
    });
    if (!parsed.success) return loginRedirectForError(request, "invalid");

    await requireRateLimit({ namespace: "login", identifiers: [trustedClientIp(request.headers)], limit: 30, windowMs: 15 * 60_000, localFallbackWhenConfiguredProviderFails: process.env.NODE_ENV !== "production" });
    const supabase = await createSupabaseServerClient({ clearExistingSessionCookies: true });
    if (!supabase) return loginRedirectForError(request, "unavailable");

    await logServerEvent("info", "login_started", { route: "/api/auth/login-form", fallback: "form_post" });
    const authStartedAt = performance.now();
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error || !data.user) {
      await logServerEvent("warn", "login_failed", { reason: "invalid_credentials", fallback: "form_post" });
      return loginRedirectForError(request, "invalid");
    }
    await logServerEvent("info", "login_supabase_session_created", {
      authUserId: data.user.id,
      durationMs: durationMs(authStartedAt),
      fallback: "form_post"
    });

    const roleStartedAt = performance.now();
    const session = await getDashboardSessionForVerifiedUser(data.user, supabase);
    if (!session) {
      const customerSession = isCustomerExperienceEnabled() ? await getCustomerSessionForVerifiedUser(data.user, supabase) : null;
      if (customerSession) {
        if (!isCustomerExperienceEnabled()) {
          await signOutFreshLoginSession(supabase, { reason: "customer_experience_disabled" });
          await logServerEvent("warn", "login_access_denied", { reason: "customer_experience_disabled", fallback: "form_post" });
          return loginRedirectForError(request, "customer-unavailable");
        }
        if (customerSession.profile.status === "pending_verification") return redirectTo(request, "/customer/verify-email");
        if (customerSession.profile.status !== "active") {
          await signOutFreshLoginSession(supabase, { reason: "customer_account_unavailable" });
          return redirectTo(request, "/customer/account-unavailable");
        }
        await logServerEvent("info", "login_role_resolution_success", {
          authUserId: data.user.id,
          role: "customer",
          durationMs: durationMs(roleStartedAt),
          fallback: "form_post"
        });
        return redirectTo(request, "/customer/shop");
      }
      await signOutFreshLoginSession(supabase, { reason: "missing_profile" });
      await logServerEvent("warn", "login_access_denied", { reason: "missing_profile", fallback: "form_post" });
      return loginRedirectForError(request, "staff");
    }

    const decision = decideDashboardAccess(session.profile);
    if (!decision.allowed) {
      await signOutFreshLoginSession(supabase, { reason: decision.reason });
      await logServerEvent("warn", "login_access_denied", { reason: decision.reason, fallback: "form_post" });
      return redirectTo(request, restrictedPathForSession(session));
    }

    const admin = createSupabaseAdminClient();
    if (admin) {
      const { error: auditError } = await admin.from("audit_logs").insert({
        user_id: session.authUserId,
        action: "login_success",
        table_name: "auth_access",
        record_id: session.staffProfileId,
        store_id: session.assignedStoreId,
        result: "success",
        details: { ipAddress: trustedClientIp(request.headers), userAgent: request.headers.get("user-agent")?.slice(0, 512) ?? null, role: session.profile.role, fallback: "form_post" }
      });
      if (auditError) {
        await logServerEvent("warn", "login_audit_write_failed", {
          authUserId: session.authUserId,
          role: session.profile.role,
          fallback: "form_post"
        });
      }
    }

    await logServerEvent("info", "login_role_resolution_success", {
      authUserId: session.authUserId,
      staffProfileId: session.staffProfileId,
      role: session.profile.role,
      storeId: session.assignedStoreId,
      durationMs: durationMs(roleStartedAt),
      fallback: "form_post"
    });

    const destination = session.isAdmin
      ? "/dashboard/admin"
      : session.isManager
        ? managerLoginDestination(session)
        : session.profile.role === "franchise_admin" ? franchiseLoginDestination(session) : receptionistLoginDestination(session);

    if (destination === "/dashboard/manager") await offerManagerWelcomeAtLogin(session);

    await logServerEvent("info", "login_ready_for_redirect", {
      authUserId: session.authUserId,
      staffProfileId: session.staffProfileId,
      role: session.profile.role,
      redirectTo: destination,
      fallback: "form_post"
    });

    return redirectTo(request, destination);
  } catch (error) {
    if (error instanceof RequestOriginError) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    if (error instanceof RateLimitExceededError) {
      return new NextResponse("Too many sign-in attempts. Please wait and try again.", {
        status: 429, headers: { ...privateHeaders, ...rateLimitHeaders(error.result) }
      });
    }
    if (error instanceof AccountLookupUnavailableError || error instanceof AuthDependencyUnavailableError) {
      await logServerEvent("warn", error instanceof AccountLookupUnavailableError ? "account_lookup_unavailable" : "supabase_temporarily_unavailable", {
        failureCategory: error.category,
        stage: error instanceof AccountLookupUnavailableError ? error.stage : error.dependency,
        temporary: error instanceof AccountLookupUnavailableError ? error.temporary : true,
        durationMs: durationMs(startedAt),
        fallback: "form_post"
      });
      return loginRedirectForError(request, "unavailable");
    }
    await reportServerException("login_form_unavailable", error);
    return loginRedirectForError(request, "unavailable");
  }
}
