import { NextResponse } from "next/server";
import { z } from "zod";
import { managerPasswordIssues } from "@/lib/manager/password-policy";
import {
  RateLimitExceededError,
  RateLimitUnavailableError,
  configuredRateLimit,
  rateLimitHeaders,
  requireRateLimit,
  trustedClientIp
} from "@/lib/rate-limit";
import { verifyOrigin } from "@/lib/security";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Vary": "Cookie, Authorization"
};

const requestSchema = z.object({
  invitationId: z.string().uuid(),
  password: z.string().min(1).max(256),
  confirmPassword: z.string().min(1).max(256)
}).strict();

export async function POST(request: Request) {
  try {
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return NextResponse.json({ ok: false, error: "Invalid request." }, {
        status: 415,
        headers: privateHeaders
      });
    }
    await verifyOrigin();

    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invitation link is invalid or expired." }, {
        status: 400,
        headers: privateHeaders
      });
    }

    const rateLimit = await requireRateLimit({
      namespace: "manager-invitation-complete",
      identifiers: [trustedClientIp(request.headers), parsed.data.invitationId],
      limit: configuredRateLimit("RATE_LIMIT_MANAGER_INVITATION_ATTEMPTS", 5),
      windowMs: 15 * 60_000,
      localFallbackWhenConfiguredProviderFails: true
    });

    const passwordIssues = managerPasswordIssues(parsed.data.password, parsed.data.confirmPassword);
    if (passwordIssues.length > 0) {
      return NextResponse.json({ ok: false, error: passwordIssues[0] }, {
        status: 400,
        headers: { ...privateHeaders, ...rateLimitHeaders(rateLimit) }
      });
    }

    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "Invitation setup is temporarily unavailable." }, {
        status: 503,
        headers: privateHeaders
      });
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    const user = userData.user;
    const metadataInvitationId = typeof user?.user_metadata?.invitation_id === "string"
      ? user.user_metadata.invitation_id
      : "";
    if (userError || !user?.email || metadataInvitationId !== parsed.data.invitationId ||
        user.user_metadata?.invited_role !== "manager") {
      await supabase.auth.signOut().catch(() => undefined);
      return NextResponse.json({ ok: false, error: "Invitation link is invalid or expired." }, {
        status: 401,
        headers: privateHeaders
      });
    }

    const { error: passwordError } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (passwordError) {
      return NextResponse.json({ ok: false, error: "Unable to set your password. Request a new invitation." }, {
        status: 400,
        headers: privateHeaders
      });
    }

    const { data: completed, error: completionError } = await supabase
      .rpc("complete_manager_invitation", { p_invitation_id: parsed.data.invitationId })
      .maybeSingle<{ staff_profile_id: string; invitation_status: string }>();
    if (completionError || !completed?.staff_profile_id) {
      return NextResponse.json({ ok: false, error: "Invitation link is invalid or expired." }, {
        status: 403,
        headers: privateHeaders
      });
    }

    return NextResponse.json({
      ok: true,
      redirectTo: "/manager/setup/account"
    }, {
      headers: { ...privateHeaders, ...rateLimitHeaders(rateLimit) }
    });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return NextResponse.json({ ok: false, error: "Too many attempts. Please wait and try again." }, {
        status: 429,
        headers: { ...privateHeaders, ...rateLimitHeaders(error.result) }
      });
    }
    const message = error instanceof RateLimitUnavailableError
      ? "Invitation protection is temporarily unavailable."
      : "Invitation setup is temporarily unavailable.";
    return NextResponse.json({ ok: false, error: message }, {
      status: 503,
      headers: privateHeaders
    });
  }
}
