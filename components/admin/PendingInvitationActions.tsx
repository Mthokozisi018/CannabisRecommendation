"use client";

import { useActionState } from "react";
import { Send, Trash2 } from "lucide-react";
import { resendInvitationAction, revokeInvitationAction, type AdminActionState } from "@/app/dashboard/admin/actions";

const initialState: AdminActionState = { ok: false, message: "" };

export function PendingInvitationActions({ invitationId }: { invitationId: string }) {
  const [resendState, resendFormAction, resendPending] = useActionState(resendInvitationAction, initialState);
  const [revokeState, revokeFormAction, revokePending] = useActionState(revokeInvitationAction, initialState);
  const state = resendState.message ? resendState : revokeState;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-4">
        <form action={resendFormAction}>
          <input type="hidden" name="invitationId" value={invitationId} />
          <button disabled={resendPending || revokePending} className="inline-flex h-11 items-center gap-2 rounded-lg border border-lime-400/65 px-5 font-bold text-lime-300 transition hover:bg-lime-400/10 disabled:cursor-wait disabled:opacity-60" type="submit">
            <Send size={18} />
            {resendPending ? "Sending..." : "Resend"}
          </button>
        </form>
        <form action={revokeFormAction}>
          <input type="hidden" name="invitationId" value={invitationId} />
          <button disabled={resendPending || revokePending} className="inline-flex h-11 items-center gap-2 rounded-lg border border-red-400/75 px-5 font-bold text-red-300 transition hover:bg-red-500/10 disabled:cursor-wait disabled:opacity-60" type="submit">
            <Trash2 size={18} />
            {revokePending ? "Revoking..." : "Revoke"}
          </button>
        </form>
      </div>
      {state.message ? <p className={`max-w-md text-sm font-semibold ${state.ok ? "text-lime-300" : "text-red-200"}`}>{state.message}</p> : null}
    </div>
  );
}
