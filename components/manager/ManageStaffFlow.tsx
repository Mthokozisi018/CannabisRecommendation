"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, LockKeyhole, LogOut, Mail, ShieldCheck, Sprout, User, UserPlus, UserRoundCheck, UserRoundX, UsersRound, X } from "lucide-react";
import { logoutGreenChoiceStaffAction } from "@/app/actions";
import { createStaffAccountAction, updateStaffStatusAction, type ManagerActionState } from "@/app/dashboard/manager/actions";
import { PendingNotice, PendingSpinner } from "@/components/manager/forms/shared";
import type { ManagerReceptionistAccount, ReceptionistSlotUsage } from "@/lib/manager/data";

const initialState: ManagerActionState = { ok: false, message: "" };
const manageStaffPanelClass = "rounded-2xl border border-[#5e9f38] bg-[#050b07] p-6 shadow-[0_22px_78px_rgba(0,0,0,0.42)]";

function StaffShell({ children, mode }: { children: React.ReactNode; mode: "accounts" | "invite" }) {
  return (
    <main className="relative isolate min-h-screen overflow-hidden px-4 py-4 text-white sm:px-6 sm:py-5">
      <div className="absolute inset-0 -z-20 bg-[#020503]" />
      <div className="absolute inset-0 -z-10 bg-[url('/images/manager/manage-staff-wallpaper.png')] bg-cover bg-center bg-no-repeat" />
      <div className={mode === "invite" ? "mx-auto max-w-[860px]" : "mx-auto max-w-[960px]"}>
        {children}
      </div>
    </main>
  );
}

function TopActions({ invite = false }: { invite?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <Link href={invite ? "/dashboard/manager/staff" : "/dashboard/manager"} className="inline-flex h-12 items-center gap-2 rounded-full border border-[#73c642] bg-[#050806] px-5 text-sm font-bold text-white shadow-[0_0_24px_rgba(123,220,52,0.16)] transition hover:border-lime-300 hover:text-lime-200">
        <ArrowLeft size={18} />
        {invite ? "Back to Manage Staff" : "Back"}
      </Link>
      <div className="inline-flex h-12 items-center rounded-full border border-[#73c642] bg-[#050806] px-3 shadow-[0_0_28px_rgba(123,220,52,0.16)]">
        <Link href="/account/team" className="inline-flex h-9 items-center gap-3 rounded-full px-3 text-sm font-bold text-white transition hover:bg-white/8">
          <User size={18} className="text-lime-300" />
          Manager profile
        </Link>
        <form action={logoutGreenChoiceStaffAction}>
          <button type="submit" aria-label="Log out" className="grid size-9 place-items-center rounded-full text-white transition hover:bg-white/10 hover:text-lime-200">
            <LogOut size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}

function Brand({ centered = false }: { centered?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 ${centered ? "justify-center" : ""}`}>
      <Sprout size={34} className="text-lime-300" fill="currentColor" />
      <p className="text-2xl font-extrabold leading-none text-white">Green<span className="text-[#72d943]">Choice</span></p>
    </div>
  );
}

function normalizedStatus(account: ManagerReceptionistAccount) {
  return account.account_status ?? (account.is_active ? "active" : "deactivated");
}

function displayName(account: ManagerReceptionistAccount) {
  const joined = [account.first_name, account.surname].filter(Boolean).join(" ");
  return joined || account.full_name || account.email;
}

function StatusPill({ status }: { status: string }) {
  const active = status === "active";
  const restricted = status === "restricted";
  return (
    <span className={`inline-flex h-8 items-center gap-2 rounded-lg px-3 text-sm font-bold ${active ? "bg-lime-400/12 text-white" : restricted ? "bg-amber-400/12 text-amber-100" : "bg-red-500/12 text-red-100"}`}>
      <span className={`size-2 rounded-full ${active ? "bg-lime-400" : restricted ? "bg-amber-400" : "bg-red-400"}`} />
      {active ? "Active" : restricted ? "Restricted" : "Deactivated"}
    </span>
  );
}

function AccountStatusPill({ account }: { account: ManagerReceptionistAccount }) {
  if (normalizedStatus(account) !== "active") return <StatusPill status={normalizedStatus(account)} />;
  if (account.temporary_password_active || !account.account_setup_complete) {
    return <span className="inline-flex h-8 items-center rounded-lg bg-[#3a3211] px-3 text-sm font-bold text-amber-100">Setup required</span>;
  }
  return <StatusPill status={normalizedStatus(account)} />;
}

function StaffActionButton({ account, action, label, tone, icon }: { account: ManagerReceptionistAccount; action: "grant" | "restrict" | "deactivate"; label: string; tone: "lime" | "amber" | "red"; icon: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateStaffStatusAction, initialState);
  const status = normalizedStatus(account);
  const duplicate = (action === "grant" && status === "active") || (action === "restrict" && status === "restricted") || (action === "deactivate" && status === "deactivated");
  const toneClass = tone === "lime"
    ? "border-lime-400/65 text-lime-300 hover:bg-lime-400/10 disabled:border-lime-400/20 disabled:text-lime-300/40"
    : tone === "amber"
      ? "border-amber-400/65 text-amber-300 hover:bg-amber-400/10 disabled:border-amber-400/20 disabled:text-amber-300/40"
      : "border-red-500/75 text-red-400 hover:bg-red-500/10 disabled:border-red-500/20 disabled:text-red-400/40";

  return (
    <>
      <button type="button" disabled={duplicate} onClick={() => setOpen(true)} className={`inline-flex h-10 min-w-[118px] items-center justify-center gap-2 whitespace-nowrap rounded-lg border bg-black/20 px-3.5 text-xs font-extrabold leading-none transition disabled:cursor-not-allowed ${toneClass}`}>
        <span className="grid size-5 shrink-0 place-items-center">{icon}</span>
        <span>{label}</span>
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/72 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-lime-400/35 bg-[#07100d] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-2xl font-extrabold">Authentication Required</p>
                <p className="mt-2 text-white/70">Confirm {label} for {displayName(account)}.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"><X size={20} /></button>
            </div>
            <form action={formAction} className="mt-6 grid gap-4">
              <input type="hidden" name="staffProfileId" value={account.id} />
              <input type="hidden" name="action" value={action} />
              <label className="text-sm font-bold text-white/86">
                Manager current password
                <span className="mt-2 flex h-12 items-center gap-3 rounded-lg border border-lime-400/35 bg-black/35 px-4">
                  <LockKeyhole size={18} className="text-lime-300" />
                  <input name="managerPassword" type="password" autoComplete="current-password" required className="min-w-0 flex-1 bg-transparent text-white outline-none" />
                </span>
              </label>
              {action === "deactivate" ? (
                <label className="text-sm font-bold text-white/86">
                  Type DEACTIVATE to confirm
                  <input name="confirmDeactivation" className="mt-2 h-12 w-full rounded-lg border border-red-400/40 bg-black/35 px-4 text-white outline-none focus:border-red-300" />
                </label>
              ) : null}
              <PendingNotice active={pending} text="Updating account access..." />
              {!pending && state.message ? <p className={`rounded-lg px-4 py-3 text-sm ${state.ok ? "border border-lime-300/30 bg-lime-500/10 text-lime-100" : "border border-red-300/30 bg-red-500/10 text-red-100"}`}>{state.message}</p> : null}
              <button type="submit" disabled={pending} aria-busy={pending} className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-lime-500 font-extrabold text-black transition hover:brightness-110 disabled:opacity-60">{pending ? <><PendingSpinner /> Updating account access...</> : "Confirm"}</button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function AccountsTable({ accounts }: { accounts: ManagerReceptionistAccount[] }) {
  return (
    <div className={`${manageStaffPanelClass} mt-4 overflow-x-auto bg-[linear-gradient(145deg,rgba(1,4,2,0.44),rgba(5,9,3,0.36))] p-3 shadow-[0_16px_48px_rgba(0,0,0,0.3),inset_0_0_28px_rgba(0,0,0,0.18)] lg:overflow-x-visible`}>
      <table className="w-full min-w-[620px] table-fixed border-collapse bg-black/10 text-left lg:min-w-0">
        <colgroup>
          <col className="w-10" />
          <col className="w-[34%]" />
          <col className="w-[20%]" />
          <col className="w-[46%]" />
        </colgroup>
        <thead className="text-lime-200">
          <tr className="border-b border-lime-400/26 bg-black/22">
            <th className="px-2 py-2.5 text-xs font-extrabold">#</th>
            <th className="px-3 py-2.5 text-xs font-extrabold">Name &amp; Surname</th>
            <th className="px-3 py-2.5 text-xs font-extrabold">Account Status</th>
            <th className="px-3 py-2.5 text-xs font-extrabold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((account, index) => (
            <tr key={account.id} className="border-b border-white/10 text-white">
              <td className="px-2 py-3 text-xs">{index + 1}</td>
              <td className="px-3 py-3 text-sm font-semibold">
                <span className="block truncate">{displayName(account)}</span>
              </td>
              <td className="px-3 py-3 align-middle"><AccountStatusPill account={account} /></td>
              <td className="px-3 py-3 align-middle">
                <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap">
                  <StaffActionButton account={account} action="grant" label="Access Granted" tone="lime" icon={<LockKeyhole size={19} />} />
                  <StaffActionButton account={account} action="restrict" label="Restricted" tone="amber" icon={<LockKeyhole size={19} />} />
                  <StaffActionButton account={account} action="deactivate" label="Deactivate" tone="red" icon={<UserRoundX size={20} />} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {accounts.length === 0 ? <p className="px-3 py-5 text-center text-xs text-white/86">No receptionist accounts found for your store.</p> : null}
    </div>
  );
}

export function ManageStaffAccountsScreen({ accounts, slotUsage }: { accounts: ManagerReceptionistAccount[]; slotUsage: ReceptionistSlotUsage }) {
  const isFull = slotUsage.used >= slotUsage.limit;
  return (
    <StaffShell mode="accounts">
      <TopActions />
      <section className="mx-auto mt-4 max-w-[920px]">
        <div className={`${manageStaffPanelClass} grid gap-3 p-4 text-center lg:grid-cols-[1fr_auto] lg:items-center lg:text-left`}>
          <div className="flex flex-col items-center gap-3 lg:flex-row">
            <span className="grid size-12 place-items-center rounded-lg border border-lime-400/25 bg-lime-400/12 text-lime-300 shadow-[0_0_22px_rgba(125,220,58,0.14)]"><UsersRound size={26} /></span>
            <div>
              <h1 className="text-2xl font-extrabold leading-tight text-white sm:text-[28px]">Manage <span className="text-[#72d943]">Staff Accounts</span></h1>
              <p className="mt-1 text-sm text-white/95">View and manage receptionist accounts for your store.</p>
              <p className="mt-0.5 text-sm text-white/95">You can grant or restrict access, or deactivate accounts when needed.</p>
            </div>
          </div>
          <Link aria-disabled={isFull} href={isFull ? "/dashboard/manager/staff" : "/dashboard/manager/staff/new"} className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg px-4 text-xs font-extrabold text-white shadow-[0_12px_28px_rgba(110,220,25,0.2)] transition ${isFull ? "cursor-not-allowed bg-white/12 text-white/45" : "bg-[linear-gradient(135deg,#94e31f,#62c610)] hover:brightness-110"}`}>
            <UserPlus size={17} />
            {isFull ? `Receptionist slots ${slotUsage.used} / ${slotUsage.limit}` : `Create Receptionist Account ${slotUsage.used} / ${slotUsage.limit}`}
          </Link>
        </div>
        <div className={`${manageStaffPanelClass} mt-4 p-4`}>
          <h2 className="text-lg font-extrabold">Current Receptionist Accounts</h2>
          <p className="mt-1 text-sm text-white/95">These accounts have access to your store.</p>
          <AccountsTable accounts={accounts} />
        </div>
        <div className={`${manageStaffPanelClass} mt-4 flex items-center gap-3 p-4`}>
          <ShieldCheck size={30} className="shrink-0 text-lime-300" />
          <div>
            <p className="text-lg font-extrabold">Authentication Required</p>
            <p className="mt-0.5 text-sm text-white/95">For your security, all actions (access changes or deactivation) require you to authenticate with your password.</p>
          </div>
        </div>
      </section>
    </StaffShell>
  );
}

export function CreateStaffScreen({ slotUsage }: { slotUsage: ReceptionistSlotUsage }) {
  const [state, formAction, pending] = useActionState(createStaffAccountAction, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const isFull = slotUsage.used >= slotUsage.limit;
  const steps = [
    { label: "Enter Account Details", icon: <KeyRound size={25} /> },
    { label: "Account Created", icon: <CheckCircle2 size={25} /> },
    { label: "Receptionist Setup", icon: <UserRoundCheck size={25} /> },
    { label: "Account Active", icon: <ShieldCheck size={25} /> }
  ];
  return (
    <StaffShell mode="invite">
      <TopActions invite />
      <section className="mx-auto mt-1 max-w-[820px] text-center">
        <Brand centered />
        <h1 className="mt-2 text-[24px] font-extrabold leading-tight sm:text-[28px]">Create a New <span className="text-[#72d943]">Staff Account</span></h1>
        <p className="mt-1 text-sm text-white/90">Create a receptionist for your assigned store. Slots used: {slotUsage.used} / {slotUsage.limit}.</p>
        <section className="mx-auto mt-3 max-w-[760px] rounded-xl border border-[#6fbd3f] bg-[#050b07] px-4 py-4 shadow-[0_14px_42px_rgba(0,0,0,0.38)]">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {steps.map((step, index) => (
              <div key={step.label} className="flex min-h-[86px] flex-col items-center justify-center gap-2 rounded-lg border border-[#497d2c] bg-[#09120c] px-2 py-3 text-lime-300">
                {step.icon}
                <span className="text-center text-xs font-extrabold leading-4"><span className="text-white/65">{index + 1}. </span>{step.label}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="mx-auto mt-3 max-w-[760px] rounded-xl border border-[#6fbd3f] bg-[#050b07] p-4 text-left shadow-[0_14px_42px_rgba(0,0,0,0.38)] sm:p-5">
          <h2 className="text-lg font-extrabold">Receptionist Account Details</h2>
          <p className="mt-1 text-xs text-white/80">The role and store are assigned securely from your manager account.</p>
          <form action={formAction} className="mt-4 grid gap-3">
            <label className="text-xs font-bold text-white">
              Email Address
              <span className="mt-1.5 flex h-12 items-center gap-3 rounded-lg border border-[#6fbd3f] bg-[#020604] px-3 text-white/75 focus-within:border-lime-300">
                <Mail size={18} />
                <input required name="email" type="email" autoComplete="email" placeholder="e.g. name@domain.com" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/45" />
              </span>
            </label>
            <label className="text-xs font-bold text-white">
              Temporary Password
              <span className="mt-1.5 flex h-12 items-center gap-3 rounded-lg border border-[#6fbd3f] bg-[#020604] px-3 text-white/75 focus-within:border-lime-300">
                <LockKeyhole size={18} />
                <input required name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={12} maxLength={256} className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none" />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide temporary password" : "Show temporary password"} className="grid size-9 place-items-center rounded-full text-white hover:bg-[#152019] hover:text-lime-200">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </span>
            </label>
            <label className="text-xs font-bold text-white">
              Confirm Temporary Password
              <span className="mt-1.5 flex h-12 items-center gap-3 rounded-lg border border-[#6fbd3f] bg-[#020604] px-3 text-white/75 focus-within:border-lime-300">
                <LockKeyhole size={18} />
                <input required name="confirmPassword" type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" minLength={12} maxLength={256} className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none" />
                <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? "Hide confirmed password" : "Show confirmed password"} className="grid size-9 place-items-center rounded-full text-white hover:bg-[#152019] hover:text-lime-200">{showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </span>
            </label>
            <p className="rounded-lg border border-[#497d2c] bg-[#09120c] px-3 py-2.5 text-xs leading-5 text-white/85">Use at least 12 characters with uppercase, lowercase, number, and symbol characters.</p>
            <PendingNotice active={pending} text="Creating account..." />
            {!pending && state.message ? <p role="alert" className={`rounded-lg border px-4 py-3 text-sm ${state.ok ? "border-[#6fbd3f] bg-[#0b1b0e] text-lime-100" : "border-[#a74747] bg-[#220b0b] text-red-100"}`}>{state.message}</p> : null}
            <button type="submit" disabled={pending || state.ok || isFull} aria-busy={pending} className="inline-flex h-14 items-center justify-center gap-2.5 rounded-lg border border-[#b8ff6d] bg-[#7de01e] px-6 text-base font-extrabold text-black shadow-[0_14px_30px_rgba(110,220,25,0.24)] transition hover:bg-[#91ed31] disabled:opacity-60">
              {pending ? <PendingSpinner /> : <UserPlus size={20} />}
              {isFull ? "Receptionist Limit Reached" : pending ? "Creating account..." : state.ok ? "Account Created" : "Create Account"}
            </button>
          </form>
        </section>
        <div className="mx-auto mt-3 flex max-w-[760px] items-center gap-3 rounded-xl border border-[#6fbd3f] bg-[#050b07] px-4 py-3 text-left">
          <ShieldCheck size={28} className="shrink-0 text-lime-300" />
          <p className="text-xs leading-5"><span className="font-extrabold text-lime-300">First login required:</span> The receptionist is assigned to your store now, but cannot use POS until they replace the temporary password and finish account setup.</p>
        </div>
      </section>
    </StaffShell>
  );
}
