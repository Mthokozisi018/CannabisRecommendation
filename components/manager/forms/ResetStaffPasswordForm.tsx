"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";
import { resetStaffPasswordAction } from "@/app/dashboard/manager/actions";
import { initialState, Message, PendingNotice, PendingSpinner } from "@/components/manager/forms/shared";

export function ResetPasswordForm({ staffProfileId }: { staffProfileId: string }) {
  const [state, action, pending] = useActionState(resetStaffPasswordAction, initialState);
  return (
    <form action={action} className="mt-3 grid gap-2">
      <input type="hidden" name="staffProfileId" value={staffProfileId} />
      <button disabled={pending} aria-busy={pending} className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-300/40 px-4 py-2 font-bold text-blue-100 disabled:opacity-60">{pending ? <PendingSpinner /> : <Mail size={16} />} {pending ? "Sending reset..." : "Send password reset"}</button>
      <PendingNotice active={pending} text="Sending password reset..." />
      {!pending ? <Message state={state} /> : null}
    </form>
  );
}
