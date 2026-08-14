import { AdminPageShell } from "@/components/admin/AdminDashboardUI";
import { PendingInvitationActions } from "@/components/admin/PendingInvitationActions";
import { getPendingManagerInvitations } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

export default async function PendingInvitationsPage() {
  const invitations = await getPendingManagerInvitations();

  return (
    <AdminPageShell>
      <section className="rounded-2xl border border-lime-400/45 bg-[linear-gradient(145deg,rgba(4,35,18,0.72),rgba(0,8,7,0.84))] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.38)] sm:p-10">
        <h1 className="text-4xl font-extrabold sm:text-5xl">Pending Invitations</h1>
        <p className="mt-4 text-lg text-white/75">View all manager accounts that have been invited but have not yet accepted the invitation.</p>
        <div className="mt-8 overflow-hidden rounded-xl border border-lime-400/35">
          <div className="grid grid-cols-[1fr_auto] border-b border-lime-400/30 bg-black/25 px-6 py-5 text-lg font-bold text-lime-400">
            <span>Manager Email</span>
            <span>Actions</span>
          </div>
          {invitations.length === 0 ? (
            <p className="px-6 py-8 text-white/72">No pending invitations.</p>
          ) : invitations.map((invitation) => (
            <div key={invitation.id} className="grid grid-cols-1 gap-4 border-b border-lime-400/20 px-6 py-5 last:border-b-0 md:grid-cols-[1fr_auto] md:items-center">
              <span className="text-lg">{invitation.email}</span>
              <PendingInvitationActions invitationId={invitation.id} />
            </div>
          ))}
        </div>
      </section>
    </AdminPageShell>
  );
}
