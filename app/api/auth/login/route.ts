import { NextResponse } from "next/server";
import { z } from "zod";
import { managerLoginDestination } from "@/lib/account-flow";
import { decideDashboardAccess, getDashboardSessionForVerifiedUser } from "@/lib/dashboard-session";
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

export async function POST(request: Request) {
  try {
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return NextResponse.json({ error: "Invalid request." }, { status: 415, headers: privateHeaders });
    }
    await verifyOrigin();
    const parsed = loginSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 400, headers: privateHeaders });
    }

    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ error: "Authentication is temporarily unavailable." }, { status: 503, headers: privateHeaders });
    }
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error || !data.user) {
      await logServerEvent("warn", "login_failed", { reason: "invalid_credentials" });
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401, headers: privateHeaders });
    }
    await logServerEvent("info", "login_supabase_session_created", { authUserId: data.user.id });

    const session = await getDashboardSessionForVerifiedUser(data.user);
    if (!session) {
      await supabase.auth.signOut();
      await logServerEvent("warn", "login_access_denied", { reason: "missing_profile" });
      return NextResponse.json({ error: "This account has not been authorized for GreenChoice. Contact the administrator." }, {
        status: 403,
        headers: privateHeaders
      });
    }
    const decision = decideDashboardAccess(session.profile);
    if (!decision.allowed) {
      await supabase.auth.signOut();
      await logServerEvent("warn", "login_access_denied", { reason: decision.reason });
      return NextResponse.json(
        { error: decision.message, reason: decision.reason, redirectTo: "/dashboard/restricted" },
        { status: 403, headers: privateHeaders }
      );
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
        details: { role: session.profile.role }
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
        : "/dashboard/receptionist";

    await logServerEvent("info", "login_ready_for_redirect", {
      authUserId: session.authUserId,
      staffProfileId: session.staffProfileId,
      role: session.profile.role,
      redirectTo
    });

    return NextResponse.json({ authenticated: true, redirectTo }, { headers: privateHeaders });
  } catch (error) {
    await reportServerException("login_unavailable", error);
    return NextResponse.json({ error: "Authentication is temporarily unavailable." }, { status: 503, headers: privateHeaders });
  }
}
