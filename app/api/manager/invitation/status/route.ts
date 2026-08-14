import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Vary": "Cookie, Authorization"
};

const invitationIdSchema = z.string().uuid();

export async function GET(request: Request) {
  const invitationId = invitationIdSchema.safeParse(new URL(request.url).searchParams.get("invitation_id"));
  if (!invitationId.success) {
    return NextResponse.json({ ok: false, error: "Invitation link is invalid or expired." }, {
      status: 400,
      headers: privateHeaders
    });
  }

  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  if (!supabase || !admin) {
    return NextResponse.json({ ok: false, error: "Invitation setup is temporarily unavailable." }, {
      status: 503,
      headers: privateHeaders
    });
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData.user;
  if (userError || !user?.email ||
      user.user_metadata?.invited_role !== "manager" ||
      user.user_metadata?.invitation_id !== invitationId.data) {
    return NextResponse.json({ ok: false, error: "Invitation link is invalid or expired." }, {
      status: 401,
      headers: privateHeaders
    });
  }

  const { data: invitation, error } = await admin
    .from("manager_invitations")
    .select("id, email, auth_user_id, status, expires_at, accepted_at, revoked_at")
    .eq("id", invitationId.data)
    .eq("auth_user_id", user.id)
    .maybeSingle<{
      id: string;
      email: string;
      auth_user_id: string;
      status: string;
      expires_at: string | null;
      accepted_at: string | null;
      revoked_at: string | null;
    }>();

  const unavailable = error ||
    !invitation ||
    invitation.status !== "pending" ||
    Boolean(invitation.revoked_at || invitation.accepted_at) ||
    invitation.email.toLowerCase() !== user.email.toLowerCase() ||
    Boolean(invitation.expires_at && new Date(invitation.expires_at).getTime() <= Date.now());
  if (unavailable) {
    return NextResponse.json({ ok: false, error: "Invitation link is invalid or expired." }, {
      status: 403,
      headers: privateHeaders
    });
  }

  return NextResponse.json({ ok: true, email: invitation.email }, { headers: privateHeaders });
}
