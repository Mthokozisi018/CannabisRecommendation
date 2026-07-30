"use client";

import { useActionState } from "react";
import { Mail, Send, UserPlus } from "lucide-react";
import { inviteManagerAction, type AdminActionState } from "@/app/dashboard/admin/actions";

const initialState: AdminActionState = { ok: false, message: "" };

export function InviteManagerForm() {
  const [state, formAction, pending] = useActionState(inviteManagerAction, initialState);

  return (
    <form action={formAction} className="mx-auto max-w-[980px] rounded-2xl border border-lime-400/45 bg-[linear-gradient(145deg,rgba(4,35,18,0.72),rgba(0,8,7,0.84))] px-6 py-12 text-center shadow-[0_28px_90px_rgba(0,0,0,0.38)] sm:px-12">
      <span className="mx-auto grid size-28 place-items-center rounded-full border border-lime-400/55 bg-lime-400/10 text-lime-300">
        <UserPlus size={58} />
      </span>
      <h1 className="mt-8 text-4xl font-extrabold sm:text-5xl">Invite Manager</h1>
      <p className="mx-auto mt-5 max-w-2xl text-xl leading-8 text-white/75">Invite a new manager to join the platform. The manager will receive an invitation email to create their account.</p>
      <div className="mx-auto mt-10 max-w-3xl text-left">
        <label htmlFor="email" className="text-lg font-bold text-lime-400">Manager Email</label>
        <div className="mt-4 flex items-center gap-4 rounded-lg border border-lime-400/65 bg-black/25 px-5">
          <Mail className="text-lime-400" size={26} />
          <input id="email" name="email" type="email" required placeholder="Enter manager email address" className="h-16 min-w-0 flex-1 bg-transparent text-lg text-white outline-none placeholder:text-white/45" />
        </div>
      </div>
      <button type="submit" disabled={pending} className="mx-auto mt-10 inline-flex h-16 w-full max-w-3xl items-center justify-center gap-3 rounded-lg bg-gradient-to-b from-lime-500 to-green-800 text-xl font-extrabold transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70">
        {pending ? "Sending..." : "SEND"}
        <Send size={28} />
      </button>
      {state.message ? <p className={`mt-6 text-base font-semibold ${state.ok ? "text-lime-300" : "text-red-200"}`}>{state.message}</p> : null}
    </form>
  );
}
