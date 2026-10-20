"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, KeyRound, Mail, UserRoundCheck } from "lucide-react";
import {
  createManagerAccountAction,
  type AdminActionState,
} from "@/app/dashboard/admin/actions";

const initialState: AdminActionState = { ok: false, message: "" };

export function CreateManagerAccountForm() {
  const [state, formAction, pending] = useActionState(
    createManagerAccountAction,
    initialState,
  );
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form
      action={formAction}
      className="mx-auto max-w-[900px] rounded-lg border border-lime-400 bg-[#04100a] px-6 py-10 text-center shadow-[0_28px_90px_rgba(0,0,0,0.5)] sm:px-10"
    >
      <span className="mx-auto grid size-24 place-items-center rounded-full border border-lime-400 bg-[#071b0d] text-lime-300">
        <UserRoundCheck size={50} aria-hidden="true" />
      </span>
      <h1 className="mt-7 text-3xl font-extrabold sm:text-4xl">
        Create Manager Account
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-white/75">
        Create the manager&apos;s initial login credentials. The manager will
        complete their personal details, password change and store registration
        during onboarding.
      </p>

      <div className="mx-auto mt-8 max-w-2xl text-left">
        <label
          htmlFor="manager-email"
          className="text-base font-bold text-lime-300"
        >
          Manager Email
        </label>
        <div className="mt-3 flex h-14 items-center gap-3 rounded-lg border border-lime-400 bg-[#07110d] px-4 focus-within:ring-2 focus-within:ring-lime-300">
          <Mail className="text-lime-400" size={22} aria-hidden="true" />
          <input
            id="manager-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="manager@example.com"
            className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/45"
          />
        </div>
      </div>

      <div className="mx-auto mt-6 max-w-2xl text-left">
        <label
          htmlFor="manager-temporary-password"
          className="text-base font-bold text-lime-300"
        >
          Temporary Password
        </label>
        <div className="mt-3 flex items-center rounded-lg border border-lime-400 bg-[#07110d] pr-2 focus-within:ring-2 focus-within:ring-lime-300">
          <input
            id="manager-temporary-password"
            name="temporaryPassword"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="new-password"
            aria-describedby="temporary-password-help"
            className="h-14 min-w-0 flex-1 rounded-lg bg-transparent px-4 text-white outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Hide temporary password" : "Show temporary password"}
            aria-pressed={showPassword}
            className="grid size-11 shrink-0 place-items-center rounded-lg text-lime-300 transition hover:bg-lime-400/10 focus-visible:outline-lime-300"
          >
            {showPassword ? <EyeOff size={22} aria-hidden="true" /> : <Eye size={22} aria-hidden="true" />}
          </button>
        </div>
        <p id="temporary-password-help" className="mt-2 text-sm text-white/65">
          The authentication provider&apos;s password requirements apply. The
          manager must replace this password during their first login.
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mx-auto mt-8 inline-flex min-h-14 w-full max-w-2xl items-center justify-center gap-3 rounded-lg bg-lime-500 px-6 text-lg font-extrabold text-black transition hover:brightness-110 disabled:cursor-wait disabled:opacity-65"
      >
        <KeyRound size={23} aria-hidden="true" />
        {pending ? "Creating..." : "Create Manager Account"}
      </button>
      {state.message ? (
        <p
          role={state.ok ? "status" : "alert"}
          className={`mx-auto mt-5 max-w-2xl rounded-lg border px-4 py-3 font-semibold ${state.ok ? "border-lime-400 bg-[#071b0d] text-lime-200" : "border-red-400 bg-[#1b0909] text-red-100"}`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
