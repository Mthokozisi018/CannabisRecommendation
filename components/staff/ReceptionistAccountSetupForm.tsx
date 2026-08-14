"use client";

import { useActionState, useState, type ReactNode } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Phone, ShieldCheck, User } from "lucide-react";
import { completeReceptionistAccountSetupAction, type ReceptionistSetupState } from "@/app/staff/setup/actions";

const initialState: ReceptionistSetupState = { ok: false, message: "" };

function Field({ name, label, icon, type = "text", autoComplete, placeholder, trailing, defaultValue }: {
  name: string;
  label: string;
  icon: ReactNode;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  trailing?: ReactNode;
  defaultValue?: string;
}) {
  return (
    <label className="block text-sm font-bold text-white">
      {label}
      <span className="mt-2 flex h-12 items-center gap-3 rounded-lg border border-[#6fbd3f] bg-[#020604] px-3 text-white/75 focus-within:border-lime-300">
        {icon}
        <input name={name} required type={type} autoComplete={autoComplete} placeholder={placeholder} defaultValue={defaultValue} className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/45" />
        {trailing}
      </span>
    </label>
  );
}

export function ReceptionistAccountSetupForm({ termsHref, privacyHref }: { termsHref: string; privacyHref: string }) {
  const [state, action, pending] = useActionState(completeReceptionistAccountSetupAction, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const values = state.values;

  return (
    <form key={state.revision} action={action} className="mx-auto mt-6 grid w-full max-w-[680px] gap-5 rounded-xl border border-[#6fbd3f] bg-[#050b07] p-5 text-left shadow-[0_24px_80px_rgba(0,0,0,0.55)] sm:p-7">
      <div className="flex items-center gap-4 border-b border-[#355a24] pb-5">
        <span className="grid size-12 shrink-0 place-items-center rounded-full border border-[#7bd246] bg-[#09120c] text-lime-300"><User size={25} /></span>
        <div>
          <h1 className="text-xl font-extrabold sm:text-2xl">Receptionist Account Setup</h1>
          <p className="mt-1 text-sm text-white/75">Complete your profile and replace your temporary password.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="firstName" label="First Name" icon={<User size={18} />} autoComplete="given-name" placeholder="Enter your first name" defaultValue={values?.firstName} />
        <Field name="surname" label="Surname" icon={<User size={18} />} autoComplete="family-name" placeholder="Enter your surname" defaultValue={values?.surname} />
      </div>
      <Field name="phoneNumber" label="Phone Number" icon={<Phone size={18} />} autoComplete="tel" placeholder="e.g. 071 123 4567" defaultValue={values?.phoneNumber} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="password"
          label="New Permanent Password"
          icon={<LockKeyhole size={18} />}
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          trailing={<button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} className="grid size-9 place-items-center rounded-full text-white hover:bg-[#152019] hover:text-lime-200">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>}
        />
        <Field
          name="confirmPassword"
          label="Confirm Permanent Password"
          icon={<LockKeyhole size={18} />}
          type={showConfirm ? "text" : "password"}
          autoComplete="new-password"
          trailing={<button type="button" onClick={() => setShowConfirm((value) => !value)} aria-label={showConfirm ? "Hide confirmed password" : "Show confirmed password"} className="grid size-9 place-items-center rounded-full text-white hover:bg-[#152019] hover:text-lime-200">{showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}</button>}
        />
      </div>
      <p className="rounded-lg border border-[#497d2c] bg-[#09120c] px-3 py-2.5 text-xs leading-5 text-white/85">Use at least 12 characters with uppercase, lowercase, number, and symbol characters.</p>

      <div className="grid gap-3 rounded-lg border border-[#497d2c] bg-[#020604] p-4">
        <label className="flex items-start gap-3 text-sm leading-5 text-white/90">
          <input name="termsAccepted" type="checkbox" required defaultChecked={values?.termsAccepted} className="mt-0.5 size-5 shrink-0 accent-lime-500" />
          <span>I accept the <a href={termsHref} target="_blank" rel="noreferrer" className="font-bold text-lime-300 underline underline-offset-2">Terms of Service</a>.</span>
        </label>
        <label className="flex items-start gap-3 text-sm leading-5 text-white/90">
          <input name="privacyAccepted" type="checkbox" required defaultChecked={values?.privacyAccepted} className="mt-0.5 size-5 shrink-0 accent-lime-500" />
          <span>I accept the <a href={privacyHref} target="_blank" rel="noreferrer" className="font-bold text-lime-300 underline underline-offset-2">Privacy Policy</a>.</span>
        </label>
      </div>

      {state.message ? <p role="alert" className="rounded-lg border border-[#a74747] bg-[#220b0b] px-4 py-3 text-sm text-red-100">{state.message}</p> : null}
      <button disabled={pending} aria-busy={pending} className="inline-flex h-14 items-center justify-center gap-3 rounded-lg border border-[#b8ff6d] bg-[#7de01e] px-6 text-base font-extrabold text-black shadow-[0_14px_32px_rgba(110,220,25,0.24)] transition hover:bg-[#91ed31] disabled:opacity-60">
        <ShieldCheck size={21} />
        {pending ? "Completing setup..." : "Complete Account Setup"}
        {!pending ? <ArrowRight size={21} /> : null}
      </button>
    </form>
  );
}
