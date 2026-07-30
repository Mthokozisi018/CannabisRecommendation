"use client";

import Link from "next/link";
import Image from "next/image";
import { useActionState, useState } from "react";
import { ArrowLeft, LockKeyhole, LogOut, Mail, Send, ShieldCheck, Sprout, User, UserPlus, UserRoundX, UsersRound, X } from "lucide-react";
import { logoutGreenChoiceStaffAction } from "@/app/actions";
import { inviteReceptionistAction, updateStaffStatusAction, type ManagerActionState } from "@/app/dashboard/manager/actions";
import { PendingNotice, PendingSpinner } from "@/components/manager/forms/shared";
import type { ManagerReceptionistAccount, ReceptionistSlotUsage } from "@/lib/manager/data";

const initialState: ManagerActionState = { ok: false, message: "" };
const manageStaffPanelClass = "rounded-2xl border border-lime-400/34 bg-[linear-gradient(145deg,rgba(2,6,3,0.58),rgba(4,10,6,0.48))] p-6 shadow-[0_22px_78px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_999px_rgba(0,0,0,0.03)] backdrop-blur-md";

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
      <Link href={invite ? "/dashboard/manager/staff" : "/dashboard/manager"} className="inline-flex h-11 items-center gap-2 rounded-full border border-lime-400/35 bg-black/48 px-5 text-sm font-bold text-white shadow-[0_0_24px_rgba(123,220,52,0.16)] backdrop-blur-md transition hover:border-lime-300 hover:text-lime-200">
        <ArrowLeft size={18} />
        {invite ? "Back to Manage Staff" : "Back"}
      </Link>
      <div className="inline-flex h-12 items-center rounded-full border border-lime-400/30 bg-black/54 px-3 shadow-[0_0_28px_rgba(123,220,52,0.16)] backdrop-blur-md">
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
              <td className="px-3 py-3 align-middle"><StatusPill status={normalizedStatus(account)} /></td>
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
      {accounts.length === 0 ? <p className="px-3 py-5 text-center text-xs text-white/86">No completed receptionist staff accounts found for your store.</p> : null}
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
            {isFull ? `Receptionist slots ${slotUsage.used} / ${slotUsage.limit}` : `Invite Receptionist ${slotUsage.used} / ${slotUsage.limit}`}
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

export function InviteStaffScreen({ slotUsage }: { slotUsage: ReceptionistSlotUsage }) {
  const [state, formAction, pending] = useActionState(inviteReceptionistAction, initialState);
  const isFull = slotUsage.used >= slotUsage.limit;
  return (
    <StaffShell mode="invite">
      <TopActions invite />
      <section className="mx-auto mt-1 max-w-[820px] text-center">
        <Brand centered />
        <h1 className="mt-2 text-[24px] font-extrabold leading-tight sm:text-[28px]">Create a New <span className="text-[#72d943]">Staff Account</span></h1>
        <p className="mt-1 text-sm text-white/90">Invite a new receptionist to join your store. Slots used: {slotUsage.used} / {slotUsage.limit}.</p>
        <section className="mx-auto mt-2.5 max-w-[760px] rounded-2xl border border-lime-400/24 bg-[#07100d]/78 px-4 py-2.5 shadow-[0_14px_42px_rgba(0,0,0,0.28)] backdrop-blur-md">
          <div className="mx-auto max-w-[690px] overflow-hidden rounded-xl">
            <Image
              src="/images/manager/badges-for-onboarding.png"
              alt="Enter Email, Invitation Sent, Onboarding, Account Active"
              width={1536}
              height={864}
              priority
              className="h-[118px] w-full object-cover object-[center_45%] sm:h-[132px]"
            />
          </div>
        </section>
        <section className="mx-auto mt-2.5 max-w-[760px] rounded-2xl border border-lime-400/24 bg-[#07100d]/78 p-3.5 text-left shadow-[0_14px_42px_rgba(0,0,0,0.28)] backdrop-blur-md">
          <h2 className="text-base font-extrabold">Email Address</h2>
          <p className="mt-1 text-xs text-white/86">Enter the email address of the person you want to invite.</p>
          <form action={formAction} className="mt-3 grid gap-2.5">
            <label className="flex h-10 items-center gap-3 rounded-lg border border-lime-400/55 bg-black/36 px-3 text-white/70 focus-within:border-lime-300">
              <Mail size={18} />
              <input required name="email" type="email" placeholder="e.g. name@domain.com" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/52" />
            </label>
            <p className="inline-flex items-center gap-2 text-xs text-white/86"><LockKeyhole size={16} /> They will receive an email with a secure link to complete their onboarding.</p>
            <PendingNotice active={pending} text="Inviting staff..." />
            {!pending && state.message ? <p className={`rounded-lg px-4 py-3 text-sm ${state.ok ? "border border-lime-300/30 bg-lime-500/10 text-lime-100" : "border border-red-300/30 bg-red-500/10 text-red-100"}`}>{state.message}</p> : null}
            <button type="submit" disabled={pending || state.ok || isFull} aria-busy={pending} className="inline-flex h-10 items-center justify-center gap-2.5 rounded-lg bg-[linear-gradient(135deg,#94e31f,#62c610)] text-sm font-extrabold text-black shadow-[0_14px_30px_rgba(110,220,25,0.2)] transition hover:brightness-110 disabled:opacity-60">
              {pending ? <PendingSpinner /> : <Send size={18} />}
              {isFull ? "Receptionist Limit Reached" : pending ? "Inviting staff..." : state.ok ? "Invitation Sent" : "Send Invitation"}
            </button>
          </form>
        </section>
        <div className="mx-auto mt-2.5 flex max-w-[760px] items-center gap-3 rounded-2xl border border-lime-400/24 bg-[#07100d]/78 px-4 py-2.5 text-left backdrop-blur-md">
          <ShieldCheck size={28} className="shrink-0 text-lime-300" />
          <p className="text-xs leading-5"><span className="font-extrabold text-lime-300">Important to know:</span> Invited staff are <span className="font-extrabold text-lime-300">not staff yet.</span> They only become staff once they complete onboarding and their account is activated.</p>
        </div>
      </section>
    </StaffShell>
  );
}
