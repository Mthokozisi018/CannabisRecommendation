import { NextResponse } from "next/server";
import { z } from "zod";
import { decideDashboardAccess, getDashboardSessionForVerifiedUser, restrictedPathForSession } from "@/lib/dashboard-session";
import { logServerEvent, reportServerException } from "@/lib/logger";
import { verifyOrigin } from "@/lib/security";
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

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url), {
    status: 303,
    headers: privateHeaders
  });
}

function loginRedirectForError(request: Request, error: string) {
  return redirectTo(request, `/login?error=${encodeURIComponent(error)}`);
}

export async function POST(request: Request) {
  try {
    await verifyOrigin();
    const formData = await request.formData();
    const parsed = loginSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password")
    });
    if (!parsed.success) return loginRedirectForError(request, "invalid");

    const supabase = await createSupabaseServerClient();
    if (!supabase) return loginRedirectForError(request, "unavailable");

    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error || !data.user) {
      await logServerEvent("warn", "login_failed", { reason: "invalid_credentials", fallback: "form_post" });
      return loginRedirectForError(request, "invalid");
    }

    const session = await getDashboardSessionForVerifiedUser(data.user);
    if (!session) {
      await supabase.auth.signOut();
      await logServerEvent("warn", "login_access_denied", { reason: "missing_profile", fallback: "form_post" });
      return loginRedirectForError(request, "staff");
    }

    const decision = decideDashboardAccess(session.profile);
    if (!decision.allowed) {
      await supabase.auth.signOut();
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
        details: { role: session.profile.role, fallback: "form_post" }
      });
      if (auditError) {
        await logServerEvent("warn", "login_audit_write_failed", {
          authUserId: session.authUserId,
          role: session.profile.role,
          fallback: "form_post"
        });
      }
    }

    const destination = session.isAdmin
      ? "/dashboard/admin"
      : session.isManager
        ? !session.accountSetupComplete
          ? "/manager/setup/account"
          : !session.storeSetupComplete
            ? "/manager/setup/store"
            : !session.onboardingCompleteSeen
              ? "/manager/setup/complete"
              : "/dashboard/manager"
        : "/dashboard/receptionist";

    await logServerEvent("info", "login_ready_for_redirect", {
      authUserId: session.authUserId,
      staffProfileId: session.staffProfileId,
      role: session.profile.role,
      redirectTo: destination,
      fallback: "form_post"
    });

    return redirectTo(request, destination);
  } catch (error) {
    await reportServerException("login_form_unavailable", error);
    return loginRedirectForError(request, "unavailable");
  }
}
