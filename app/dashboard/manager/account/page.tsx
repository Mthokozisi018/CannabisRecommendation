import { Mail, Phone, UserRound } from "lucide-react";
import { requireCompletedManagerDashboardSession } from "@/lib/manager/onboarding";

export const dynamic = "force-dynamic";

export default async function ManagerAccountPage() {
  const session = await requireCompletedManagerDashboardSession();
  const profile = session.profile;
  const phone = profile.phone_number || profile.mobile_number || "Not set";
  return (
    <main className="relative isolate min-h-screen px-4 pb-10 pt-28 text-white sm:px-7 lg:px-10">
      <section className="mx-auto w-full max-w-4xl rounded-[24px] border border-[#294432] bg-[#09140d] p-7 shadow-[0_24px_70px_rgba(0,0,0,0.42)] sm:p-9">
        <div className="flex items-center gap-4"><span className="grid size-14 place-items-center rounded-full bg-[#123d22] text-[#69ec82]"><UserRound size={28} /></span><div><h1 className="text-3xl font-black">Manage Account</h1><p className="mt-1 text-sm font-semibold text-white/58">Current manager account information</p></div></div>
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-[#263a2d] bg-[#0d1912] p-5"><p className="text-xs font-black uppercase tracking-wide text-white/45">Manager</p><p className="mt-2 text-xl font-black text-[#70ed86]">{session.displayName}</p><p className="mt-2 text-sm font-semibold text-white/60">Store Manager</p></article>
          <article className="rounded-2xl border border-[#263a2d] bg-[#0d1912] p-5"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-white/45"><Mail size={14} /> Email</p><p className="mt-2 break-all text-base font-bold">{session.email}</p><p className="mt-4 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-white/45"><Phone size={14} /> Phone</p><p className="mt-2 text-base font-bold">{phone}</p></article>
        </div>
        <p className="mt-5 rounded-xl border border-[#42552e] bg-[#1b2412] px-4 py-3 text-sm font-semibold leading-6 text-[#d6e7a9]">Account editing remains isolated from the subscription work in this branch, so the Stripe change cannot overwrite your existing onboarding or account logic.</p>
      </section>
    </main>
  );
}
