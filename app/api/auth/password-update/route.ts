import { NextResponse } from "next/server";
import { z } from "zod";
import type { User } from "@supabase/supabase-js";
import { auditAccessDenied, decideDashboardAccess, getDashboardSession } from "@/lib/dashboard-session";
import { managerPasswordIssues } from "@/lib/manager/password-policy";
import { verifyOrigin } from "@/lib/security";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  password: z.string().min(8).max(256),
  confirmPassword: z.string().min(8).max(256)
}).strict();
const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", "Vary": "Cookie, Authorization" };

async function hasPendingStaffInvitationSession(user: User) {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase admin client is not configured.");

  const staffInvitationId = typeof user.user_metadata?.staff_invitation_id === "string"
    ? user.user_metadata.staff_invitation_id
    : null;
  const checks = [];
  if (staffInvitationId) {
    checks.push(admin.from("staff_invitations").select("id", { count: "exact", head: true })
      .eq("id", staffInvitationId).eq("auth_user_id", user.id).in("status", ["pending", "accepted"]));
  }
  if (checks.length === 0) return false;
  const results = await Promise.all(checks);
  if (results.some((result) => result.error)) throw new Error("Unable to verify password reset purpose.");
  return results.some((result) => (result.count ?? 0) > 0);
}

export async function POST(request: Request) {
  try {
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return NextResponse.json({ error: "Invalid request." }, { status: 415, headers: privateHeaders });
    }
    await verifyOrigin();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success || managerPasswordIssues(parsed.data.password, parsed.data.confirmPassword).length) {
      return NextResponse.json({ error: "Password does not meet the security requirements." }, { status: 400, headers: privateHeaders });
    }
    const supabase = await createSupabaseServerClient();
    if (!supabase) return NextResponse.json({ error: "Password reset is unavailable." }, { status: 503, headers: privateHeaders });
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return NextResponse.json({ error: "Password reset session is invalid or expired." }, { status: 401, headers: privateHeaders });
    if (await hasPendingStaffInvitationSession(userData.user)) {
      return NextResponse.json({
        error: "This is a first-time staff invitation session. Complete staff onboarding before using password recovery."
      }, { status: 409, headers: privateHeaders });
    }
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) return NextResponse.json({ error: "Password reset session is invalid or expired." }, { status: 401, headers: privateHeaders });

    const session = await getDashboardSession();
    const decision = decideDashboardAccess(session?.profile);
    if (!decision.allowed && session) {
      await auditAccessDenied(session, "password_reset_completed_restricted_account", decision.reason);
    }
    await supabase.auth.signOut();
    return NextResponse.json({
      updated: true,
      message: "Password updated successfully. Please log in again.",
      redirectTo: "/login"
    }, { headers: privateHeaders });
  } catch {
    return NextResponse.json({ error: "Password reset is unavailable." }, { status: 503, headers: privateHeaders });
  }
}
