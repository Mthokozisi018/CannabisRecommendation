import { NextResponse } from "next/server";
import { z } from "zod";
import { auditAccessDenied, decideDashboardAccess, getDashboardSession } from "@/lib/dashboard-session";
import { managerPasswordIssues } from "@/lib/manager/password-policy";
import { RequestOriginError, verifyOrigin } from "@/lib/security";
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

    // Profile lookup and auditing are supplementary to the Auth password change.
    // A temporary profile database failure must not report a failed reset after
    // Supabase has already accepted the new password.
    try {
      const session = await getDashboardSession();
      const decision = decideDashboardAccess(session?.profile);
      if (!decision.allowed && session) {
        await auditAccessDenied(session, "password_reset_completed_restricted_account", decision.reason);
      }
    } catch {
      // The next login still enforces the user's unchanged role and access state.
    }
    await supabase.auth.signOut({ scope: "local" });
    return NextResponse.json({
      updated: true,
      message: "Your password has been updated successfully. You can now sign in using your new password.",
      redirectTo: "/login"
    }, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof RequestOriginError) return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers: privateHeaders });
    return NextResponse.json({ error: "Password reset is unavailable." }, { status: 503, headers: privateHeaders });
  }
}
