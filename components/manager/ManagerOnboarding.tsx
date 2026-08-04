"use client";

import { useActionState, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, Building2, CheckCircle2, Eye, EyeOff, Grid2X2, LockKeyhole, Mail, Map, MapPin, Phone, ShieldCheck, Sparkles, Store, UserRound } from "lucide-react";
import { completeManagerAccountSetupAction, completeStoreRegistrationAction, finishManagerOnboardingAction, type SetupActionState } from "@/app/manager/setup/actions";
import { southAfricanProvinces } from "@/lib/manager/onboarding-options";
import type { ManagerAccountInitialValues, StoreRegistrationInitialValues } from "@/lib/manager/onboarding";

const initialState: SetupActionState = { ok: false, message: "" };

type LegalDocumentsStatus = {
  available: boolean;
  termsHref: string;
  privacyHref: string;
  missingLabels: string[];
};

type StepState = "complete" | "active" | "upcoming";

function GreenChoiceMark() {
  return (
    <div className="text-center">
      <div className="mx-auto grid size-24 place-items-center rounded-full border border-lime-400 text-lime-300 shadow-[0_0_38px_rgba(166,255,24,0.2)]">
        <svg viewBox="0 0 96 96" className="size-16" role="img" aria-label="GreenChoice">
          <path d="M48 12c8 16 8 30 0 41-8-11-8-25 0-41Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
          <path d="M21 28c17 3 28 11 33 25-16 2-28-8-33-25Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
          <path d="M75 28c-17 3-28 11-33 25 16 2 28-8 33-25Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
          <path d="M22 58c13-7 25-6 36 3-12 8-25 6-36-3Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
          <path d="M74 58c-13-7-25-6-36 3 12 8 25 6 36-3Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
          <path d="M48 50v31" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
        </svg>
      </div>
      <p className="mt-5 text-2xl font-black uppercase tracking-wide text-white">
        <span className="text-lime-400">Green</span>Choice
      </p>
    </div>
  );
}

function Shell({ children, heading, accent, body, compact = false }: { children: ReactNode; heading: string; accent: string; body: string; compact?: boolean }) {
  return (
    <main className={`relative isolate min-h-screen overflow-hidden bg-[#010403] px-4 text-white sm:px-6 lg:px-8 ${compact ? "py-5" : "py-8"}`}>
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(0,0,0,.9),rgba(0,0,0,.58),rgba(0,0,0,.86)),url('/images/backgrounds/manager-dashboard-wallpaper.png')] bg-cover bg-center opacity-95" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-72 bg-[linear-gradient(0deg,rgba(110,205,32,.2),transparent)]" />

      <section className="mx-auto w-full max-w-[1320px]">
        {compact ? null : <GreenChoiceMark />}
        <header className={`text-center ${compact ? "mt-1" : "mt-7"}`}>
          <h1 className={`text-balance font-black tracking-normal ${compact ? "text-3xl sm:text-4xl" : "text-4xl sm:text-5xl"}`}>
            {heading} <span className="text-lime-400">{accent}</span>
          </h1>
          <p className={`mx-auto max-w-2xl text-balance text-white/72 ${compact ? "mt-2 text-base leading-6" : "mt-5 text-lg leading-8 sm:text-xl"}`}>{body}</p>
        </header>
        {children}
      </section>
    </main>
  );
}

function ProgressStep({ number, title, subtitle, state }: { number: number; title: string; subtitle: string; state: StepState }) {
  const active = state === "active";
  const complete = state === "complete";
  return (
    <div className="flex min-w-0 items-center gap-4">
      <span className={`grid size-12 shrink-0 place-items-center rounded-full border text-lg font-black ${active ? "border-lime-300 bg-lime-400 text-black shadow-[0_0_24px_rgba(166,255,24,0.32)]" : complete ? "border-lime-400 bg-lime-400/10 text-lime-300" : "border-lime-400/35 bg-black/50 text-white"}`}>
        {number}
      </span>
      <span className="min-w-0">
        <span className={`block font-bold ${active ? "text-lime-300" : "text-white/90"}`}>{title}</span>
        <span className="mt-1 block text-sm text-white/58">{subtitle}</span>
      </span>
    </div>
  );
}

function Progress({ current }: { current: 1 | 2 | 3 }) {
  const stateFor = (step: 1 | 2 | 3): StepState => (step < current ? "complete" : step === current ? "active" : "upcoming");
  return (
    <nav aria-label="Manager onboarding progress" className="mx-auto mt-10 grid max-w-5xl gap-5 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
      <ProgressStep number={1} title="Account Registration" subtitle={current > 1 ? "Completed" : "Create your account"} state={stateFor(1)} />
      <span aria-hidden="true" className="hidden h-px min-w-20 bg-lime-400/55 md:block" />
      <ProgressStep number={2} title="Store Registration" subtitle={current > 2 ? "Completed" : current === 2 ? "In Progress" : "Set up your store"} state={stateFor(2)} />
      <span aria-hidden="true" className="hidden h-px min-w-20 bg-lime-400/55 md:block" />
      <ProgressStep number={3} title="Complete" subtitle="You're all set!" state={stateFor(3)} />
    </nav>
  );
}

function Field({ label, name, placeholder, icon, type = "text", className = "", defaultValue = "", minLength, maxLength, pattern, inputMode, autoComplete, trailing, solid = false }: {
  label: string;
  name: string;
  placeholder: string;
  icon: ReactNode;
  type?: string;
  className?: string;
  defaultValue?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  inputMode?: "text" | "tel" | "numeric";
  autoComplete?: string;
  trailing?: ReactNode;
  solid?: boolean;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="font-semibold text-white">{label}</span>
      <span className={`mt-2 flex h-12 items-center gap-3 rounded-lg border px-4 text-white/55 transition ${solid ? "border-[#466757] bg-[#020806] focus-within:border-[#9ee66b]" : "border-white/16 bg-black/35 focus-within:border-lime-300/85"}`}>
        <span className="text-lime-400">{icon}</span>
        <input name={name} type={type} required defaultValue={defaultValue} placeholder={placeholder} minLength={minLength} maxLength={maxLength} pattern={pattern} inputMode={inputMode} autoComplete={autoComplete} className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/42" />
        {trailing}
      </span>
    </label>
  );
}

function PhoneField({ label, name, defaultValue = "", solid = false }: { label: string; name: string; defaultValue?: string; solid?: boolean }) {
  return (
    <Field
      label={label}
      name={name}
      defaultValue={defaultValue}
      placeholder="e.g. 071 123 4567"
      icon={<Phone size={21} />}
      inputMode="tel"
      solid={solid}
    />
  );
}

function ProvinceField({ defaultValue = "", solid = false }: { defaultValue?: string; solid?: boolean }) {
  return (
    <label className="block">
      <span className="font-semibold text-white">Province</span>
      <span className={`mt-2 flex h-12 items-center gap-3 rounded-lg border px-4 text-white/55 transition ${solid ? "border-[#466757] bg-[#020806] focus-within:border-[#9ee66b]" : "border-white/16 bg-black/35 focus-within:border-lime-300/85"}`}>
        <Map size={21} className="text-lime-400" />
        <select name="province" required defaultValue={defaultValue} className="min-w-0 flex-1 bg-transparent text-base text-white outline-none">
          <option value="" className="bg-[#07100d]">Select province</option>
          {southAfricanProvinces.map((province) => <option key={province} value={province} className="bg-[#07100d]">{province}</option>)}
        </select>
      </span>
    </label>
  );
}

function SectionTitle({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="flex items-start gap-5">
      <span className="grid size-16 shrink-0 place-items-center rounded-full border border-lime-400 text-lime-300">
        {icon}
      </span>
      <div>
        <h2 className="text-2xl font-black text-white">{title}</h2>
        <p className="mt-2 text-lg leading-7 text-white/62">{body}</p>
      </div>
    </div>
  );
}

export function ManagerAccountSetupForm({ legalDocuments, initialValues, mustChangePassword, accountEmail }: { legalDocuments: LegalDocumentsStatus; initialValues: ManagerAccountInitialValues; mustChangePassword: boolean; accountEmail: string }) {
  const [state, formAction, pending] = useActionState(completeManagerAccountSetupAction, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const values = state.accountValues ?? initialValues;

  return (
    <Shell compact heading="Manager" accent="Onboarding" body="Complete your account details before registering your store.">
      <div className="mx-auto mt-4 max-w-5xl">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-bold text-lime-300">Step 1 of 3 · Account registration</span>
          <span className="min-w-0 break-all text-left text-white/70 sm:text-right">Signed in as {accountEmail}</span>
        </div>
        <form key={state.revision ?? "initial"} action={formAction} autoComplete="off" className="rounded-lg border border-[#65c83d] bg-[#06100c] p-5 shadow-[0_24px_80px_rgba(0,0,0,.5)] sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full border border-[#65c83d] bg-[#0a1811] text-lime-300"><UserRound size={23} /></span>
            <div>
              <h2 className="text-xl font-black text-white">Account Registration</h2>
              <p className="mt-1 text-sm text-white/68">Enter your own information. All fields start empty for a new manager.</p>
            </div>
          </div>

          <div className="mt-5">
            <h3 className="text-lg font-black text-lime-400">Personal Information</h3>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <Field solid label="Full Name" name="fullName" defaultValue={values.fullName} placeholder="Enter your full name" icon={<UserRound size={21} />} minLength={2} autoComplete="off" />
              <Field solid label="Surname" name="surname" defaultValue={values.surname} placeholder="Enter your surname" icon={<UserRound size={21} />} minLength={2} autoComplete="off" />
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
              <PhoneField solid label="Phone Number" name="phoneNumber" defaultValue={values.phoneNumber} />
              <Field solid label="Physical Address" name="physicalAddress" defaultValue={values.physicalAddress} placeholder="Enter your street address" icon={<MapPin size={21} />} minLength={5} autoComplete="off" />
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Field solid label="City / Town" name="city" defaultValue={values.city} placeholder="Enter city" icon={<Building2 size={21} />} minLength={2} autoComplete="off" />
              <ProvinceField solid defaultValue={values.province} />
              <Field solid label="Postal Code" name="postalCode" defaultValue={values.postalCode} placeholder="e.g. 0001" icon={<Mail size={21} />} pattern="[0-9]{4}" inputMode="numeric" autoComplete="off" />
            </div>
          </div>

          {mustChangePassword ? (
            <section className="mt-5 border-t border-[#315140] pt-5">
              <h3 className="text-lg font-black text-lime-400">Create Your Permanent Password</h3>
              <p className="mt-1 text-sm text-white/68">Your authenticated session will be used to replace the temporary password securely.</p>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <Field
                  solid
                  label="New Password"
                  name="permanentPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your new password"
                  icon={<LockKeyhole size={21} />}
                  minLength={12}
                  autoComplete="new-password"
                  trailing={
                    <button type="button" onClick={() => setShowPassword((value) => !value)} className="grid size-9 place-items-center rounded-full text-lime-300 transition hover:bg-lime-400/10" aria-label={showPassword ? "Hide password" : "Show password"}>
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  }
                />
                <Field
                  solid
                  label="Confirm New Password"
                  name="confirmPermanentPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your new password"
                  icon={<LockKeyhole size={21} />}
                  minLength={12}
                  autoComplete="new-password"
                  trailing={
                    <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} className="grid size-9 place-items-center rounded-full text-lime-300 transition hover:bg-lime-400/10" aria-label={showConfirmPassword ? "Hide password" : "Show password"}>
                      {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  }
                />
              </div>
              <div className="mt-3 rounded-lg border border-[#466757] bg-[#091812] p-3">
                <p className="text-sm font-semibold text-white">Password must contain:</p>
                <div className="mt-2 grid gap-2 text-xs text-white/74 sm:grid-cols-2 lg:grid-cols-3">
                  {["At least 12 characters", "At least 1 uppercase letter", "At least 1 lowercase letter", "At least 1 number", "At least 1 special character", "Passwords match"].map((item) => (
                    <span key={item} className="flex items-center gap-2"><CheckCircle2 size={16} className="text-lime-400" />{item}</span>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          <section className="mt-5">
            <h3 className="text-lg font-black text-lime-400">Terms & Policies</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="flex min-h-12 items-center gap-3 rounded-lg border border-[#466757] bg-[#020806] px-3 text-white">
                <input name="termsAccepted" type="checkbox" required defaultChecked={state.accountValues?.termsAccepted ?? false} disabled={!legalDocuments.available} className="size-5 accent-lime-500 disabled:opacity-50" />
                <span className="min-w-0 flex-1">I agree to the <span className="font-bold text-lime-300">Terms of Service</span></span>
                <a href={legalDocuments.termsHref} target="_blank" rel="noopener noreferrer" className="rounded-md border border-[#65c83d] bg-[#0a1811] px-3 py-2 text-sm font-bold text-lime-300 transition hover:bg-[#11251a]">View</a>
              </label>
              <label className="flex min-h-12 items-center gap-3 rounded-lg border border-[#466757] bg-[#020806] px-3 text-white">
                <input name="privacyAccepted" type="checkbox" required defaultChecked={state.accountValues?.privacyAccepted ?? false} disabled={!legalDocuments.available} className="size-5 accent-lime-500 disabled:opacity-50" />
                <span className="min-w-0 flex-1">I agree to the <span className="font-bold text-lime-300">Privacy Policy</span></span>
                <a href={legalDocuments.privacyHref} target="_blank" rel="noopener noreferrer" className="rounded-md border border-[#65c83d] bg-[#0a1811] px-3 py-2 text-sm font-bold text-lime-300 transition hover:bg-[#11251a]">View</a>
              </label>
            </div>
            {!legalDocuments.available ? (
              <p className="mt-4 rounded-lg border border-amber-300/30 bg-amber-500/10 px-4 py-3 text-amber-100">
                Legal documents are missing: {legalDocuments.missingLabels.join(", ")}. Add the PDFs to public/legal before continuing.
              </p>
            ) : null}
          </section>

          {state.message ? <p role="alert" className="mt-4 rounded-lg border border-[#d56a6a] bg-[#2a1010] px-4 py-3 text-red-100">{state.message}</p> : null}
          <button disabled={pending || !legalDocuments.available} className="mt-5 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-lg bg-[linear-gradient(135deg,#c8ff15,#76d719)] px-6 text-lg font-black text-black shadow-[0_12px_34px_rgba(157,255,24,0.22)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">
            {pending ? "Saving..." : "Continue to Store Registration"}
            <ArrowRight size={28} />
          </button>
        </form>
      </div>
    </Shell>
  );
}

export function StoreRegistrationForm({ initialValues }: { initialValues: StoreRegistrationInitialValues }) {
  const [state, formAction, pending] = useActionState(completeStoreRegistrationAction, initialState);
  const [formValid, setFormValid] = useState(false);

  function updateValidity(event: FormEvent<HTMLFormElement>) {
    setFormValid(event.currentTarget.checkValidity());
  }

  return (
    <Shell heading="Store" accent="Registration" body="Add your store details so we can create your store and connect it to your manager account.">
      <Progress current={2} />
      <form action={formAction} onInput={updateValidity} onChange={updateValidity} className="mx-auto mt-10 max-w-6xl rounded-[22px] border border-lime-400/55 bg-[linear-gradient(145deg,rgba(6,13,11,.9),rgba(0,0,0,.88))] p-6 shadow-[0_30px_120px_rgba(0,0,0,.52)] sm:p-9">
        <SectionTitle icon={<Store size={34} />} title="Store Information" body="Fill in your store details below." />
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <Field label="Store Name" name="storeName" defaultValue={initialValues.storeName} placeholder="Enter store name" icon={<Store size={21} />} minLength={2} maxLength={100} />
          <PhoneField label="Store Phone Number (Owner)" name="storePhoneNumber" defaultValue={initialValues.storePhoneNumber} />
        </div>
        <div className="mt-6">
          <Field label="Store Physical Address" name="physicalStoreAddress" defaultValue={initialValues.physicalStoreAddress} placeholder="Enter store street address" icon={<MapPin size={21} />} minLength={5} />
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Field label="City / Town" name="city" defaultValue={initialValues.city} placeholder="Enter city or town" icon={<Building2 size={21} />} minLength={2} />
          <ProvinceField defaultValue={initialValues.province} />
        </div>
        <div className="mt-6 max-w-md">
          <Field label="Postal Code" name="postalCode" defaultValue={initialValues.postalCode} placeholder="e.g. 0001" icon={<Mail size={21} />} pattern="[0-9]{4}" inputMode="numeric" />
        </div>
        <label className="mt-8 flex items-start gap-4 rounded-lg border border-lime-400/20 bg-lime-400/10 p-5 text-white">
          <input name="informationAccurate" type="checkbox" required className="mt-1 size-5 accent-lime-500" />
          <span>
            <span className="block font-semibold">I confirm that all the information provided is accurate and correct.</span>
            <span className="mt-2 block text-white/62">This information will be used to set up your store in the system.</span>
          </span>
        </label>
        {state.message ? <p className="mt-6 rounded-lg border border-red-300/25 bg-red-500/10 px-4 py-3 text-red-100">{state.message}</p> : null}
        <button disabled={pending || !formValid} className="mt-8 inline-flex min-h-16 w-full items-center justify-center gap-4 rounded-lg bg-[linear-gradient(135deg,#c8ff15,#76d719)] px-6 text-xl font-black text-black shadow-[0_18px_50px_rgba(157,255,24,0.25)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">
          {pending ? "Completing..." : "Complete Store Registration"}
          <ArrowRight size={28} />
        </button>
      </form>
    </Shell>
  );
}

function CompleteRow({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="grid grid-cols-[48px_1fr_32px] items-center gap-5 border-b border-white/10 py-5 last:border-0">
      <span className="grid size-12 place-items-center rounded-full border border-lime-400 text-lime-300">{icon}</span>
      <span>
        <span className="block text-lg font-black text-white">{title}</span>
        <span className="mt-1 block text-white/60">{body}</span>
      </span>
      <CheckCircle2 size={28} className="text-lime-300" />
    </div>
  );
}

export function ManagerOnboardingCompleteScreen() {
  return (
    <Shell heading="Onboarding" accent="Complete" body="Congratulations! Your account and store are all set up. You're now ready to manage your store.">
      <Progress current={3} />
      <section className="mx-auto mt-10 max-w-5xl rounded-[22px] border border-lime-400/55 bg-[linear-gradient(145deg,rgba(6,13,11,.9),rgba(0,0,0,.88))] p-6 text-center shadow-[0_30px_120px_rgba(0,0,0,.52)] sm:p-10">
        <div className="mx-auto grid size-28 place-items-center rounded-full border-4 border-lime-400 text-lime-300 shadow-[0_0_44px_rgba(166,255,24,0.32)]">
          <CheckCircle2 size={68} />
        </div>
        <h2 className="mt-8 text-4xl font-black text-white">All <span className="text-lime-400">Set!</span></h2>
        <p className="mx-auto mt-5 max-w-2xl text-xl leading-9 text-white/72">Your account has been secured, your store is registered, and you can now start managing your business with <span className="font-bold text-lime-300">GreenChoice</span>.</p>

        <div className="mx-auto mt-9 max-w-3xl rounded-xl border border-white/12 bg-black/28 px-6">
          <CompleteRow icon={<UserRound size={26} />} title="Account Registration" body="Your personal account details are saved." />
          <CompleteRow icon={<Store size={26} />} title="Store Registration" body="Your store is created and linked to your account." />
          <CompleteRow icon={<ShieldCheck size={26} />} title="Security & Access" body="Your account is secure and ready to use." />
        </div>

        <div className="mx-auto mt-9 max-w-3xl border-t border-white/12 pt-7 text-left">
          <p className="flex items-center gap-4 text-xl text-white/86"><Sparkles size={30} className="text-lime-300" />Let&apos;s grow your business together. Welcome to <span className="font-bold text-lime-300">GreenChoice</span>.</p>
        </div>

        <form action={finishManagerOnboardingAction} className="mx-auto mt-9 max-w-3xl">
          <button className="inline-flex min-h-16 w-full items-center justify-center gap-5 rounded-lg bg-[linear-gradient(135deg,#c8ff15,#76d719)] px-6 text-xl font-black text-black shadow-[0_18px_50px_rgba(157,255,24,0.25)] transition hover:brightness-110">
            <Grid2X2 size={30} />
            Go to Manager Dashboard
            <ArrowRight size={30} />
          </button>
          <p className="mt-4 flex items-center justify-center gap-2 text-sm text-white/52"><LockKeyhole size={16} />You will be redirected to your store&apos;s dashboard.</p>
        </form>
      </section>
    </Shell>
  );
}
