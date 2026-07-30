import { NextResponse } from "next/server";
import { z } from "zod";
import { auditAccessDenied, decideDashboardAccess, getDashboardSession, restrictedPathForSession } from "@/lib/dashboard-session";
import { managerPasswordIssues } from "@/lib/manager/password-policy";
import { verifyOrigin } from "@/lib/security";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  password: z.string().min(8).max(256),
  confirmPassword: z.string().min(8).max(256)
}).strict();
const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", "Vary": "Cookie, Authorization" };

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
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) return NextResponse.json({ error: "Password reset session is invalid or expired." }, { status: 401, headers: privateHeaders });

    const session = await getDashboardSession();
    const decision = decideDashboardAccess(session?.profile);
    const restricted = !decision.allowed;
    if (!decision.allowed && session) {
      await auditAccessDenied(session, "password_reset_completed_restricted_account", decision.reason);
    }
    const redirectTo = restricted ? restrictedPathForSession(session) : "/login";
    const message = restricted
      ? "Your password was changed successfully, but this account currently has restricted access. Please contact your store administrator or GreenChoice support."
      : "Password updated successfully. Please log in again.";
    await supabase.auth.signOut();
    return NextResponse.json({ updated: true, restricted, message, redirectTo }, { headers: privateHeaders });
  } catch {
    return NextResponse.json({ error: "Password reset is unavailable." }, { status: 503, headers: privateHeaders });
  }
}
