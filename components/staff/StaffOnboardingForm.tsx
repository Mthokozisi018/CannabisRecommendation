"use client";

import { useActionState, useState, type ReactNode } from "react";
import { BriefcaseBusiness, Check, ChevronDown, Eye, EyeOff, LockKeyhole, Mail, Map, MapPin, Phone, ShieldCheck, User, UserRound } from "lucide-react";
import { completeStaffOnboardingAction, type StaffOnboardingState } from "@/app/staff/invitation/actions";
import { southAfricanProvinces } from "@/lib/manager/onboarding-options";

const initialState: StaffOnboardingState = { ok: false, message: "" };

function Field({
  name,
  label,
  placeholder,
  icon,
  type = "text",
  autoComplete,
  required = true,
  readOnly = false,
  defaultValue = "",
  pattern,
  inputMode,
  trailing
}: {
  name: string;
  label: string;
  placeholder: string;
  icon: ReactNode;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  readOnly?: boolean;
  defaultValue?: string;
  pattern?: string;
  inputMode?: "text" | "tel" | "numeric" | "email";
  trailing?: ReactNode;
}) {
  return (
    <label className="block text-xs font-bold text-white/92">
      {label}
      <span className="mt-1.5 flex h-10 items-center gap-2.5 rounded-md border border-white/16 bg-black/36 px-3 text-white/55 transition focus-within:border-lime-300/80">
        <span className="text-white/82">{icon}</span>
        <input
          name={name}
          type={type}
          autoComplete={autoComplete}
          required={required}
          readOnly={readOnly}
          defaultValue={defaultValue}
          placeholder={placeholder}
          pattern={pattern}
          inputMode={inputMode}
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/42 read-only:text-white/82"
        />
        {trailing}
      </span>
    </label>
  );
}

function SelectField({ name, label, icon, children, defaultValue = "", disabled = false }: { name: string; label: string; icon: ReactNode; children: ReactNode; defaultValue?: string; disabled?: boolean }) {
  return (
    <label className="block text-xs font-bold text-white/92">
      {label}
      <span className="mt-1.5 flex h-10 items-center gap-2.5 rounded-md border border-white/16 bg-black/36 px-3 text-white/55 transition focus-within:border-lime-300/80">
        <span className="text-white/82">{icon}</span>
        <select name={name} required defaultValue={defaultValue} disabled={disabled} className="min-w-0 flex-1 appearance-none bg-transparent text-sm text-white outline-none disabled:opacity-100">
          {children}
        </select>
        <ChevronDown size={17} className="text-white/72" />
      </span>
    </label>
  );
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="border-t border-white/13 pt-4 first:border-t-0 first:pt-0">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="text-lime-400">{icon}</span>
        <h2 className="text-base font-extrabold text-[#67bd46]">{title}</h2>
        <span className="h-px min-w-0 flex-1 bg-white/14" />
      </div>
      {children}
    </section>
  );
}

export function StaffOnboardingForm({ invitationId, email }: { invitationId: string; email: string }) {
  const [state, formAction, pending] = useActionState(completeStaffOnboardingAction, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <form action={formAction} className="mx-auto mt-5 grid w-full max-w-[720px] gap-4 rounded-lg border border-lime-400/35 bg-[#060b08]/86 p-5 text-left shadow-[0_22px_70px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md sm:p-6">
      <input type="hidden" name="invitationId" value={invitationId} />
      <div className="flex items-center gap-4">
        <span className="grid size-[52px] shrink-0 place-items-center rounded-full border border-lime-400 text-lime-300">
          <UserRound size={28} />
        </span>
        <div>
          <h1 className="text-xl font-extrabold text-white">Complete Your Profile</h1>
          <p className="mt-1.5 text-sm text-white/78">Please provide your details to complete your account setup.</p>
        </div>
      </div>

      <Section icon={<User size={20} />} title="Personal Information">
        <div className="grid gap-4">
          <Field name="firstName" label="First Name" placeholder="Enter your first name" icon={<User size={17} />} autoComplete="given-name" />
          <Field name="surname" label="Surname" placeholder="Enter your surname" icon={<User size={17} />} autoComplete="family-name" />
          <Field name="phoneNumber" label="Phone Number" placeholder="e.g. 071 123 4567" icon={<Phone size={17} />} autoComplete="tel" inputMode="tel" />
          <Field name="alternativePhone" label="Alternative Phone (Optional)" placeholder="e.g. 082 123 4567" icon={<Phone size={17} />} autoComplete="tel" inputMode="tel" required={false} />
          <Field name="email" label="Email Address" placeholder="Invitation email" icon={<Mail size={17} />} type="email" inputMode="email" autoComplete="email" readOnly defaultValue={email} />
        </div>
      </Section>

      <Section icon={<MapPin size={20} />} title="Address Information">
        <div className="grid gap-4">
          <Field name="streetAddress" label="Street Address" placeholder="Enter your street address" icon={<MapPin size={17} />} autoComplete="street-address" />
          <Field name="city" label="City" placeholder="Enter your city" icon={<Map size={17} />} autoComplete="address-level2" />
          <SelectField name="province" label="Province" icon={<Map size={17} />}>
            <option value="" className="bg-[#07100d]">Select your province</option>
            {southAfricanProvinces.map((province) => <option key={province} value={province} className="bg-[#07100d]">{province}</option>)}
          </SelectField>
          <Field name="postalCode" label="Postal Code" placeholder="Enter your postal code" icon={<Mail size={17} />} autoComplete="postal-code" pattern="[0-9]{4}" inputMode="numeric" />
          <SelectField name="country" label="Country" icon={<MapPin size={17} />} defaultValue="South Africa">
            <option value="South Africa" className="bg-[#07100d]">South Africa</option>
          </SelectField>
        </div>
      </Section>

      <Section icon={<BriefcaseBusiness size={20} />} title="Professional Information">
        <div className="grid gap-4">
          <Field name="employeeId" label="Employee ID (Optional)" placeholder="Enter your employee ID" icon={<BriefcaseBusiness size={17} />} required={false} />
          <Field name="role" label="Role" placeholder="Receptionist" icon={<User size={17} />} readOnly defaultValue="Receptionist" />
        </div>
      </Section>

      <Section icon={<LockKeyhole size={20} />} title="Account Security">
        <div className="grid gap-4">
          <Field
            name="password"
            label="Create New Password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter a strong password"
            icon={<LockKeyhole size={17} />}
            autoComplete="new-password"
            trailing={<button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} className="grid size-8 place-items-center rounded-full text-white/75 transition hover:bg-white/10 hover:text-lime-200">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>}
          />
          <Field
            name="confirmPassword"
            label="Confirm New Password"
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Confirm your password"
            icon={<LockKeyhole size={17} />}
            autoComplete="new-password"
            trailing={<button type="button" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? "Hide password" : "Show password"} className="grid size-8 place-items-center rounded-full text-white/75 transition hover:bg-white/10 hover:text-lime-200">{showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>}
          />
        </div>
        <div className="mt-3 flex items-center gap-2.5 rounded-md border border-lime-400/20 bg-lime-400/10 px-3 py-2.5 text-xs leading-5 text-white">
          <ShieldCheck size={18} className="shrink-0 text-lime-300" />
          <p><span className="font-extrabold">Password Requirements:</span> At least 8 characters long with a mix of uppercase, lowercase, numbers, and symbols.</p>
        </div>
      </Section>

      {state.message ? <p className={`rounded-md px-4 py-3 text-sm ${state.ok ? "border border-lime-300/30 bg-lime-500/10 text-lime-100" : "border border-red-300/30 bg-red-500/10 text-red-100"}`}>{state.message}</p> : null}

      <div className="flex flex-col gap-4 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex min-w-0 items-start gap-2.5 text-xs leading-5 text-white/86">
          <input name="termsAccepted" type="checkbox" required className="mt-0.5 size-4 shrink-0 accent-lime-500" />
          <span>I accept the <span className="font-bold text-[#67bd46]">Terms &amp; Conditions</span> and <span className="font-bold text-[#67bd46]">Privacy Policy</span>.</span>
        </label>
        <button disabled={pending} className="inline-flex h-11 min-w-[190px] items-center justify-center gap-2.5 rounded-md bg-[#4f963f] px-6 text-sm font-extrabold text-white transition hover:brightness-110 disabled:opacity-60">
          <Check size={18} />
          {pending ? "Completing..." : "Complete Profile"}
        </button>
      </div>
    </form>
  );
}
