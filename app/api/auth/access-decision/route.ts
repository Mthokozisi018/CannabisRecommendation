import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { decideDashboardAccess, getDashboardSession, restrictedPathForSession } from "@/lib/dashboard-session";
import { getCustomerSession } from "@/lib/customer/auth";
import { logServerEvent } from "@/lib/logger";
import { verifyOrigin } from "@/lib/security";
import { managerLoginDestination, receptionistLoginDestination } from "@/lib/account-flow";

export const dynamic = "force-dynamic";
const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", "Vary": "Cookie, Authorization" };

async function auditAccess(action: string, details: Record<string, unknown>, recordId?: string | null) {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin.from("audit_logs").insert({
    user_id: typeof details.authUserId === "string" ? details.authUserId : null,
    action,
    table_name: "auth_access",
    record_id: recordId ?? null,
    store_id: typeof details.storeId === "string" ? details.storeId : null,
    result: "denied",
    details
  });
}

export async function GET() {
  const customer = await getCustomerSession();
  if (customer?.profile.status === "active") {
    return NextResponse.json({ allowed: true, role: "customer", redirectTo: "/customer" }, { headers: privateHeaders });
  }

  const session = await getDashboardSession();
  if (!session) {
    await auditAccess("access_denied_missing_session", { reason: "missing_session" });
    await logServerEvent("warn", "auth_access_decision_missing_session", { reason: "missing_session" });
    return NextResponse.json({ allowed: false, reason: "missing_session", redirectTo: "/login" }, { status: 401, headers: privateHeaders });
  }

  const decision = decideDashboardAccess(session.profile);
  if (!decision.allowed) {
    await auditAccess(
      decision.reason === "store_restricted" ? "access_denied_store_status" : "access_denied_account_status",
      {
        reason: decision.reason,
        authUserId: session.authUserId,
        staffProfileId: session.staffProfileId,
        accountStatus: session.accountStatus,
        storeId: session.assignedStoreId,
        storeAccessStatus: session.storeAccessStatus
      },
      session.staffProfileId
    );
    await logServerEvent("warn", "auth_access_decision_denied", {
      reason: decision.reason,
      authUserId: session.authUserId,
      staffProfileId: session.staffProfileId,
      role: session.profile.role,
      storeId: session.assignedStoreId,
      storeAccessStatus: session.storeAccessStatus
    });
    return NextResponse.json(
      { allowed: false, reason: decision.reason, message: decision.message, redirectTo: restrictedPathForSession(session) },
      { status: 403, headers: privateHeaders }
    );
  }

  return NextResponse.json({
    allowed: true,
    role: session.role,
    redirectTo: session.isAdmin
      ? "/dashboard/admin"
      : session.isManager
        ? managerLoginDestination(session)
        : receptionistLoginDestination(session)
  }, { headers: privateHeaders });
}

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ allowed: false, reason: "invalid_request" }, { status: 415, headers: privateHeaders });
  }

  let context = "";
  try {
    await verifyOrigin();
    const body = await request.json() as { context?: string };
    context = body.context ?? "";
  } catch {
    return NextResponse.json({ allowed: false, reason: "invalid_request" }, { status: 400, headers: privateHeaders });
  }

  const response = await GET();
  if (response.status === 401 || response.status === 403) {
    if (context === "password_reset_completed") {
      try {
        const payload = await response.clone().json() as { reason?: string };
        await auditAccess("password_reset_completed_restricted_account", { reason: payload.reason ?? "restricted_after_password_reset" });
      } catch {
        await auditAccess("password_reset_completed_restricted_account", { reason: "restricted_after_password_reset" });
      }
    }
    const supabase = await createSupabaseServerClient();
    await supabase?.auth.signOut();
  }
  return response;
}
