"use client";

import { useActionState } from "react";
import { Link2, Mail, UserRoundCheck } from "lucide-react";
import { connectManualManagerAction, type AdminActionState } from "@/app/dashboard/admin/actions";

const initialState: AdminActionState = { ok: false, message: "" };

export function ConnectManagerForm() {
  const [state, formAction, pending] = useActionState(connectManualManagerAction, initialState);

  return (
    <form action={formAction} className="mx-auto max-w-[900px] rounded-lg border border-lime-400 bg-[#04100a] px-6 py-10 text-center shadow-[0_28px_90px_rgba(0,0,0,0.5)] sm:px-10">
      <span className="mx-auto grid size-24 place-items-center rounded-full border border-lime-400 bg-[#071b0d] text-lime-300">
        <UserRoundCheck size={50} />
      </span>
      <h1 className="mt-7 text-3xl font-extrabold sm:text-4xl">Connect Manager</h1>
      <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-white/75">Connect an existing, confirmed Supabase Auth user to GreenChoice manager onboarding.</p>
      <div className="mx-auto mt-8 max-w-2xl text-left">
        <label htmlFor="manager-email" className="text-base font-bold text-lime-300">Manager Email</label>
        <div className="mt-3 flex h-14 items-center gap-3 rounded-lg border border-lime-400 bg-[#07110d] px-4">
          <Mail className="text-lime-400" size={22} />
          <input id="manager-email" name="email" type="email" required autoComplete="email" placeholder="manager@example.com" className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/45" />
        </div>
      </div>
      <button type="submit" disabled={pending} className="mx-auto mt-8 inline-flex min-h-14 w-full max-w-2xl items-center justify-center gap-3 rounded-lg bg-lime-500 px-6 text-lg font-extrabold text-black transition hover:brightness-110 disabled:cursor-wait disabled:opacity-65">
        <Link2 size={23} />
        {pending ? "Connecting..." : "Connect Manager"}
      </button>
      {state.message ? <p className={`mx-auto mt-5 max-w-2xl rounded-lg border px-4 py-3 font-semibold ${state.ok ? "border-lime-400 bg-[#071b0d] text-lime-200" : "border-red-400 bg-[#1b0909] text-red-100"}`}>{state.message}</p> : null}
    </form>
  );
}
