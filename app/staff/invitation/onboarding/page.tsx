import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AlertTriangle, Sprout } from "lucide-react";
import { StaffOnboardingForm } from "@/components/staff/StaffOnboardingForm";
import { StaffInvitationSessionGate } from "@/components/staff/StaffInvitationSessionGate";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type InvitationStatus = {
  ok: boolean;
  title: string;
  message: string;
  invitation?: { id: string; email: string };
};

const neutralInvitationMessage = "This invitation is unavailable. Open the latest link from your invitation email or ask your manager for a new invitation.";

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="relative isolate min-h-screen overflow-hidden px-4 py-8 text-white sm:px-6">
      <div className="absolute inset-0 -z-20 bg-[#020503]" />
      <div className="absolute inset-0 -z-10 bg-[url('/images/manager/manage-staff-wallpaper.png')] bg-cover bg-center bg-no-repeat" />
      <div className="absolute inset-0 -z-10 bg-black/28" />
      <section className="mx-auto w-full max-w-[1220px] text-center">
        <div className="flex items-center justify-center gap-4">
          <Sprout size={48} className="text-lime-300" fill="currentColor" />
          <div className="text-left">
            <p className="text-3xl font-extrabold uppercase leading-none tracking-normal"><span className="text-lime-400">Green</span>Choice</p>
            <p className="mt-1 text-xs uppercase tracking-[0.5em] text-white/70">Workstation</p>
          </div>
        </div>
        {children}
        <div className="mx-auto mt-5 flex max-w-[1060px] items-center justify-center gap-4 text-xs text-white/62">
          <span className="h-px min-w-16 flex-1 bg-lime-400/22" />
          <span>© 2026 GreenChoice Workstation. All rights reserved.</span>
          <span className="h-px min-w-16 flex-1 bg-lime-400/22" />
        </div>
      </section>
    </main>
  );
}

function InvalidInvitation({ title, message }: { title: string; message: string }) {
  return (
    <div className="mx-auto mt-10 max-w-2xl rounded-lg border border-lime-400/28 bg-[#060b08]/86 p-8 shadow-[0_26px_90px_rgba(0,0,0,0.54)] backdrop-blur-md">
      <AlertTriangle className="mx-auto text-amber-300" size={58} />
      <h1 className="mt-5 text-4xl font-extrabold">{title}</h1>
      <p className="mt-4 text-lg leading-8 text-white/78">{message}</p>
      <Link href="/login" className="mt-7 inline-flex h-12 items-center rounded-md bg-lime-500 px-7 font-extrabold text-black transition hover:brightness-110">Return to Login</Link>
    </div>
  );
}

async function validateInvitation(invitationId: string, userEmail: string, userId: string, invitationMetadataId: unknown): Promise<InvitationStatus> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, title: "Service Unavailable", message: "Staff onboarding is temporarily unavailable. Please try again later." };

  const { data: invitation, error } = await admin
    .from("staff_invitations")
    .select("id, email, auth_user_id, store_id, intended_role, invited_by, status, expires_at, revoked_at, accepted_at, completed_at, failed_at")
    .eq("id", invitationId)
    .maybeSingle();
  if (error || !invitation) return { ok: false, title: "Invitation Unavailable", message: neutralInvitationMessage };
  const identityMatches =
    invitation.auth_user_id === userId &&
    invitation.email.toLowerCase() === userEmail.toLowerCase() &&
    invitationMetadataId === invitation.id;
  if (!identityMatches || invitation.intended_role !== "receptionist") {
    return { ok: false, title: "Invitation Unavailable", message: neutralInvitationMessage };
  }
  if (invitation.revoked_at || invitation.failed_at || invitation.completed_at ||
      !["pending", "accepted"].includes(invitation.status)) {
    return { ok: false, title: "Invitation Unavailable", message: neutralInvitationMessage };
  }
  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    return { ok: false, title: "Invitation Unavailable", message: neutralInvitationMessage };
  }

  const [{ data: store }, { data: manager }] = await Promise.all([
    admin.from("stores").select("id, store_access_status, is_active").eq("id", invitation.store_id).maybeSingle(),
    admin.from("staff_profiles").select("id, role, store_id, account_status, is_active").or(`auth_user_id.eq.${invitation.invited_by},user_id.eq.${invitation.invited_by}`).maybeSingle()
  ]);
  if (!store || store.store_access_status === "restricted" || store.is_active === false) {
    return { ok: false, title: "Invitation Unavailable", message: neutralInvitationMessage };
  }
  if (!manager || manager.role !== "manager" || manager.store_id !== invitation.store_id || (manager.account_status ? manager.account_status !== "active" : manager.is_active !== true)) {
    return { ok: false, title: "Invitation Unavailable", message: neutralInvitationMessage };
  }

  return { ok: true, title: "Ready", message: "", invitation: { id: invitation.id, email: invitation.email } };
}

export default async function StaffInvitationOnboardingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const invitationId = typeof params.invitation_id === "string" ? params.invitation_id : "";
  if (!invitationId) redirect("/login?error=staff");

  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?error=unavailable");
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user?.email) {
    return (
      <Shell>
        <StaffInvitationSessionGate invitationId={invitationId} />
      </Shell>
    );
  }

  const status = await validateInvitation(
    invitationId,
    user.email,
    user.id,
    user.user_metadata?.staff_invitation_id
  );

  return (
    <Shell>
      {status.ok && status.invitation ? (
        <StaffOnboardingForm invitationId={status.invitation.id} email={status.invitation.email} />
      ) : (
        <InvalidInvitation title={status.title} message={status.message} />
      )}
    </Shell>
  );
}
