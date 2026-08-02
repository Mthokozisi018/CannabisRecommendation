"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Check, ChevronDown, Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react";
import { changeOwnAccountPasswordAction, updateOwnAccountProfileAction, type AccountActionState } from "@/app/dashboard/account-actions";
import { accountRoleTitle, type AccountRole, type DashboardAccountProfile } from "@/components/account/account-types";
import { southAfricanProvinces } from "@/lib/manager/onboarding-options";

type AccountManagementFormsProps = {
  role: AccountRole;
  profile: DashboardAccountProfile;
};

const initialState: AccountActionState = { ok: false, message: "" };
const fieldShell = "mt-1.5 flex min-h-11 items-center gap-2.5 rounded-md border border-[#296646] bg-[#020805] px-3 text-white transition focus-within:border-[#53f095]";
const inputClass = "min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-[#7a9184] read-only:text-[#c9d5cd]";

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
    <label className="block text-xs font-black uppercase tracking-normal text-[#cfe7d7]">
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
    <label className="block text-xs font-black uppercase tracking-normal text-[#cfe7d7]">
      {label}
      <span className={fieldShell}>
        <select name={name} defaultValue={defaultValue} required className={`${inputClass} appearance-none`}>
          <option value="" className="bg-[#031008]">Select province</option>
          {southAfricanProvinces.map((province) => (
            <option key={province} value={province} className="bg-[#031008]">{province}</option>
          ))}
        </select>
        <ChevronDown size={17} className="shrink-0 text-[#8df2b1]" />
      </span>
    </label>
  );
}

function StatusMessage({ state }: { state: AccountActionState }) {
  if (!state.message) return null;
  return (
    <p className={`rounded-md border px-3 py-2 text-sm font-bold ${state.ok ? "border-[#48d984] bg-[#062112] text-[#d7ffe4]" : "border-[#e25454] bg-[#260707] text-[#ffd1d1]"}`}>
      {state.message}
    </p>
  );
}

export function AccountManagementForms({ role, profile }: AccountManagementFormsProps) {
  const [profileState, profileAction, profilePending] = useActionState(updateOwnAccountProfileAction, initialState);
  const [passwordState, passwordAction, passwordPending] = useActionState(changeOwnAccountPasswordAction, initialState);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const title = accountRoleTitle(role);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <section className="rounded-lg border border-[#36d179] bg-[#031008] p-4 text-white shadow-[0_18px_48px_rgba(0,0,0,0.42)] sm:p-5">
        <div className="mb-4 flex items-center gap-2.5">
          <UserRound size={20} className="text-[#8df2b1]" aria-hidden="true" />
          <h2 className="text-lg font-black">Manage {title} Account</h2>
        </div>
        <form action={profileAction} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field name="firstName" label="First name" defaultValue={profile.firstName} autoComplete="given-name" />
            <Field name="surname" label="Surname" defaultValue={profile.surname} autoComplete="family-name" />
          </div>
          <Field name="email" label="Email" defaultValue={profile.email} type="email" inputMode="email" readOnly />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field name="phoneNumber" label="Phone number" defaultValue={profile.phoneNumber} autoComplete="tel" inputMode="tel" />
            <Field name="alternativePhone" label="Alternative phone" defaultValue={profile.alternativePhone} autoComplete="tel" inputMode="tel" required={false} />
          </div>
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
          <button disabled={profilePending} className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#8df2b1] bg-[#23c875] px-4 text-sm font-black text-[#021009] transition hover:bg-[#61e99b] disabled:opacity-60">
            <Check size={17} aria-hidden="true" />
            {profilePending ? "Saving..." : "Save Account Details"}
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-[#36d179] bg-[#031008] p-4 text-white shadow-[0_18px_48px_rgba(0,0,0,0.42)] sm:p-5">
        <div className="mb-4 flex items-center gap-2.5">
          <LockKeyhole size={20} className="text-[#8df2b1]" aria-hidden="true" />
          <h2 className="text-lg font-black">Change {title} Password</h2>
        </div>
        <form action={passwordAction} className="grid gap-3">
          <Field name="currentPassword" label="Current password" type={showCurrentPassword ? "text" : "password"} autoComplete="current-password">
            <button type="button" onClick={() => setShowCurrentPassword((value) => !value)} aria-label={showCurrentPassword ? "Hide current password" : "Show current password"} className="grid size-8 place-items-center rounded-full border border-[#296646] bg-[#07130d] text-[#cfe7d7] transition hover:border-[#7cf0aa] hover:text-white">
              {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </Field>
          <Field name="newPassword" label="New password" type={showNewPassword ? "text" : "password"} autoComplete="new-password">
            <button type="button" onClick={() => setShowNewPassword((value) => !value)} aria-label={showNewPassword ? "Hide new password" : "Show new password"} className="grid size-8 place-items-center rounded-full border border-[#296646] bg-[#07130d] text-[#cfe7d7] transition hover:border-[#7cf0aa] hover:text-white">
              {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </Field>
          <Field name="confirmPassword" label="Confirm new password" type={showConfirmPassword ? "text" : "password"} autoComplete="new-password">
            <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"} className="grid size-8 place-items-center rounded-full border border-[#296646] bg-[#07130d] text-[#cfe7d7] transition hover:border-[#7cf0aa] hover:text-white">
              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </Field>
          <p className="rounded-md border border-[#296646] bg-[#07130d] px-3 py-2 text-xs font-semibold leading-5 text-[#dcefe3]">Use at least 8 characters with uppercase, lowercase, a number, and a special character.</p>
          <StatusMessage state={passwordState} />
          <button disabled={passwordPending} className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#8df2b1] bg-[#23c875] px-4 text-sm font-black text-[#021009] transition hover:bg-[#61e99b] disabled:opacity-60">
            <LockKeyhole size={17} aria-hidden="true" />
            {passwordPending ? "Changing..." : "Change Password"}
          </button>
        </form>
      </section>
    </div>
  );
}
