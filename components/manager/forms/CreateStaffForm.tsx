"use client";

import { useActionState } from "react";
import { ShieldCheck, UserPlus } from "lucide-react";
import { createStaffAccountAction } from "@/app/dashboard/manager/actions";
import { Field, initialState, inputClass, Message, panelClass, PendingNotice, PendingSpinner } from "@/components/manager/forms/shared";

export function CreateStaffForm() {
  const [state, action, pending] = useActionState(createStaffAccountAction, initialState);
  return (
    <form action={action} className={`${panelClass} space-y-5`}>
      <PendingNotice active={pending} text="Creating staff account..." />
      {!pending ? <Message state={state} /> : null}
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="First Name*"><input className={inputClass} name="firstName" required /></Field>
        <Field label="Surname*"><input className={inputClass} name="surname" required /></Field>
      </div>
      <Field label="Email Address*"><input className={inputClass} name="email" type="email" required /></Field>
      <Field label="Mobile Number*"><input className={inputClass} name="mobileNumber" required /></Field>
      <Field label="Physical Address*"><textarea className={`${inputClass} min-h-24 py-3`} name="physicalAddress" required /></Field>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Temporary Password*"><input className={inputClass} name="password" type="password" required /></Field>
        <Field label="Confirm Password*"><input className={inputClass} name="confirmPassword" type="password" required /></Field>
      </div>
      <button disabled={pending} aria-busy={pending} className="inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-lime-500 px-5 font-extrabold text-white transition hover:bg-lime-400 disabled:opacity-60">{pending ? <PendingSpinner /> : <UserPlus size={22} />} {pending ? "Creating staff account..." : "Create Staff Account"}</button>
      <p className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/65"><ShieldCheck className="mr-2 inline text-lime-300" size={18} /> New staff accounts default to receptionist access.</p>
    </form>
  );
}
