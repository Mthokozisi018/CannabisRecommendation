"use client";

import { useActionState, useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Check, ChevronDown, Eye, EyeOff, LogOut, LockKeyhole, UserRound, X } from "lucide-react";
import { changeOwnAccountPasswordAction, logoutOwnAccountAction, updateOwnAccountProfileAction, type AccountActionState } from "@/app/dashboard/account-actions";
import { southAfricanProvinces } from "@/lib/manager/onboarding-options";

export type DashboardAccountProfile = {
  firstName: string;
  surname: string;
  email: string;
  phoneNumber: string;
  alternativePhone: string;
  physicalAddress: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  employeeId: string;
};

type DashboardAccountPanelProps = {
  role: "manager" | "receptionist";
  profile: DashboardAccountProfile;
  className?: string;
};

const initialState: AccountActionState = { ok: false, message: "" };
const fieldShell = "mt-1.5 flex min-h-11 items-center gap-2.5 rounded-md border border-white/16 bg-black/38 px-3 text-white/60 transition focus-within:border-emerald-300/85";
const inputClass = "min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/38 read-only:text-white/72";

function roleTitle(role: DashboardAccountPanelProps["role"]) {
  return role === "manager" ? "Manager" : "Receptionist";
}

function Field({
  name,
  label,
  defaultValue,
  type = "text",
  autoComplete,
  readOnly = false,
  required = true,
  inputMode,
  children
}: {
  name: string;
  label: string;
  defaultValue?: string;
  type?: string;
  autoComplete?: string;
  readOnly?: boolean;
  required?: boolean;
  inputMode?: "text" | "tel" | "numeric" | "email";
  children?: ReactNode;
}) {
  return (
    <label className="block text-xs font-black uppercase tracking-normal text-white/70">
      {label}
      <span className={fieldShell}>
        <input name={name} type={type} defaultValue={defaultValue} autoComplete={autoComplete} readOnly={readOnly} required={required} inputMode={inputMode} className={inputClass} />
        {children}
      </span>
    </label>
  );
}

function SelectField({ name, label, defaultValue }: { name: string; label: string; defaultValue: string }) {
  return (
    <label className="block text-xs font-black uppercase tracking-normal text-white/70">
      {label}
      <span className={fieldShell}>
        <select name={name} defaultValue={defaultValue} required className={`${inputClass} appearance-none`}>
          <option value="" className="bg-[#06100b]">Select province</option>
          {southAfricanProvinces.map((province) => (
            <option key={province} value={province} className="bg-[#06100b]">{province}</option>
          ))}
        </select>
        <ChevronDown size={17} className="shrink-0 text-emerald-200/80" />
      </span>
    </label>
  );
}

function StatusMessage({ state }: { state: AccountActionState }) {
  if (!state.message) return null;
  return (
    <p className={`rounded-md border px-3 py-2 text-sm font-bold ${state.ok ? "border-emerald-300/35 bg-emerald-400/10 text-emerald-100" : "border-red-300/35 bg-red-500/10 text-red-100"}`}>
      {state.message}
    </p>
  );
}

export function DashboardAccountPanel({ role, profile, className = "" }: DashboardAccountPanelProps) {
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [profileState, profileAction, profilePending] = useActionState(updateOwnAccountProfileAction, initialState);
  const [passwordState, passwordAction, passwordPending] = useActionState(changeOwnAccountPasswordAction, initialState);
  const [loggingOut, startLogout] = useTransition();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const title = roleTitle(role);

  const closePanel = useCallback(() => {
    if (dirty && !window.confirm("You have unsaved account changes. Close the panel anyway?")) return;
    setOpen(false);
    setDirty(false);
  }, [dirty]);

  function togglePanel() {
    if (open) {
      closePanel();
      return;
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closePanel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closePanel, open]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={togglePanel}
        aria-expanded={open}
        aria-controls="dashboard-account-panel"
        className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-emerald-300/45 bg-[#04100a]/92 px-4 text-sm font-black text-white shadow-[0_0_22px_rgba(16,185,129,0.18),0_12px_30px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:border-emerald-200 hover:bg-[#07180f] hover:text-lime-100 focus-visible:ring-2 focus-visible:ring-emerald-100 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020503] ${className}`}
      >
        <UserRound size={18} aria-hidden="true" />
        Account
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80]" aria-hidden={!open}>
          <button type="button" aria-label="Close account panel" onClick={closePanel} className="absolute inset-0 h-full w-full bg-black/58 backdrop-blur-[2px]" />
          <aside
            id="dashboard-account-panel"
            ref={panelRef}
            tabIndex={-1}
            aria-label={`${title} account panel`}
            className="absolute right-0 top-0 flex h-full w-full max-w-[440px] flex-col overflow-y-auto border-l border-emerald-300/24 bg-[#031008]/98 p-4 text-white shadow-[0_0_60px_rgba(0,0,0,0.72),inset_1px_0_0_rgba(255,255,255,0.08)] outline-none transition sm:p-5"
          >
            <div className="sticky top-0 z-10 -mx-4 -mt-4 flex items-center justify-between gap-3 border-b border-white/10 bg-[#031008]/96 px-4 py-4 backdrop-blur sm:-mx-5 sm:-mt-5 sm:px-5">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-normal text-emerald-300">{title} Account</p>
                <h2 className="truncate text-2xl font-black">Account</h2>
              </div>
              <button type="button" onClick={closePanel} aria-label="Close account panel" className="grid size-10 shrink-0 place-items-center rounded-full border border-white/14 text-white/78 transition hover:border-emerald-200 hover:text-white">
                <X size={19} aria-hidden="true" />
              </button>
            </div>

            <div className="mt-5 grid gap-6">
              <section className="rounded-lg border border-emerald-300/18 bg-white/[0.035] p-4">
                <div className="mb-4 flex items-center gap-2.5">
                  <UserRound size={20} className="text-emerald-300" aria-hidden="true" />
                  <h3 className="text-lg font-black">Manage {title} Account</h3>
                </div>
                <form action={profileAction} onChange={() => setDirty(true)} onSubmit={() => setDirty(false)} className="grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field name="firstName" label="First name" defaultValue={profile.firstName} autoComplete="given-name" />
                    <Field name="surname" label="Surname" defaultValue={profile.surname} autoComplete="family-name" />
                  </div>
                  <Field name="email" label="Email" defaultValue={profile.email} type="email" inputMode="email" readOnly />
                  <Field name="phoneNumber" label="Phone number" defaultValue={profile.phoneNumber} autoComplete="tel" inputMode="tel" />
                  <Field name="alternativePhone" label="Alternative phone" defaultValue={profile.alternativePhone} autoComplete="tel" inputMode="tel" required={false} />
                  <Field name="physicalAddress" label="Address" defaultValue={profile.physicalAddress} autoComplete="street-address" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field name="city" label="City" defaultValue={profile.city} autoComplete="address-level2" />
                    <SelectField name="province" label="Province" defaultValue={profile.province} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field name="postalCode" label="Postal code" defaultValue={profile.postalCode} inputMode="numeric" autoComplete="postal-code" />
                    <Field name="country" label="Country" defaultValue={profile.country || "South Africa"} readOnly />
                  </div>
                  {profile.employeeId ? <Field name="employeeId" label="Employee ID" defaultValue={profile.employeeId} readOnly required={false} /> : null}
                  <StatusMessage state={profileState} />
                  <button disabled={profilePending} className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 text-sm font-black text-[#021009] transition hover:bg-emerald-300 disabled:opacity-55">
                    <Check size={17} aria-hidden="true" />
                    {profilePending ? "Saving..." : "Save Account Details"}
                  </button>
                </form>
              </section>

              <section className="rounded-lg border border-emerald-300/18 bg-white/[0.035] p-4">
                <div className="mb-4 flex items-center gap-2.5">
                  <LockKeyhole size={20} className="text-emerald-300" aria-hidden="true" />
                  <h3 className="text-lg font-black">Change {title} Password</h3>
                </div>
                <form action={passwordAction} className="grid gap-3">
                  <Field name="currentPassword" label="Current password" type={showCurrentPassword ? "text" : "password"} autoComplete="current-password">
                    <button type="button" onClick={() => setShowCurrentPassword((value) => !value)} aria-label={showCurrentPassword ? "Hide current password" : "Show current password"} className="grid size-8 place-items-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-emerald-100">
                      {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </Field>
                  <Field name="newPassword" label="New password" type={showNewPassword ? "text" : "password"} autoComplete="new-password">
                    <button type="button" onClick={() => setShowNewPassword((value) => !value)} aria-label={showNewPassword ? "Hide new password" : "Show new password"} className="grid size-8 place-items-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-emerald-100">
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </Field>
                  <Field name="confirmPassword" label="Confirm new password" type={showConfirmPassword ? "text" : "password"} autoComplete="new-password">
                    <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"} className="grid size-8 place-items-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-emerald-100">
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </Field>
                  <p className="rounded-md border border-emerald-300/18 bg-emerald-400/8 px-3 py-2 text-xs font-semibold leading-5 text-white/78">Use at least 8 characters with uppercase, lowercase, a number, and a special character.</p>
                  <StatusMessage state={passwordState} />
                  <button disabled={passwordPending} className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 text-sm font-black text-[#021009] transition hover:bg-emerald-300 disabled:opacity-55">
                    <LockKeyhole size={17} aria-hidden="true" />
                    {passwordPending ? "Changing..." : "Change Password"}
                  </button>
                </form>
              </section>
            </div>

            <div className="mt-auto pt-6">
              <div className="border-t border-white/12 pt-4">
                <button
                  type="button"
                  disabled={loggingOut}
                  onClick={() => {
                    if (!window.confirm("Log out of GreenChoice now?")) return;
                    startLogout(async () => {
                      await logoutOwnAccountAction();
                    });
                  }}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md border border-red-300/40 bg-red-500/13 px-4 text-sm font-black text-red-100 transition hover:border-red-200 hover:bg-red-500/22 disabled:opacity-55"
                >
                  <LogOut size={18} aria-hidden="true" />
                  {loggingOut ? "Logging out..." : "Log Out"}
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
