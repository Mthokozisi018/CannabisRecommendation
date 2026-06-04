import Link from "next/link";
import { LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import { AccountHero, GlassPanel } from "@/components/AccountChrome";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function LoginPage() {
  const enabled = Boolean(await createSupabaseServerClient());
  return (
    <main>
      <AccountHero eyebrow="Welcome back to" title="GreenChoice" body="Sign in to the correct workspace with role-aware access, consent checks and adult-access controls." />
      <section className="mx-auto max-w-2xl px-4 pb-8">
        <GlassPanel className="-mt-8">
          <h1 className="text-4xl font-bold">Account <span className="text-lime-400">Sign In</span></h1>
          <p className="mt-3 text-white/68">{enabled ? "Supabase Auth is configured for production cookie sessions." : "Local preview mode uses synthetic staff context for protected workstation pages."}</p>
          <form className="mt-8 grid gap-5">
            <label className="block text-sm">Email<span className="mt-2 flex h-14 items-center gap-3 rounded-lg border border-white/15 bg-black/25 px-4"><Mail size={22} /><input className="flex-1 bg-transparent outline-none" defaultValue="admin@greenchoice.local" /></span></label>
            <label className="block text-sm">Password<span className="mt-2 flex h-14 items-center gap-3 rounded-lg border border-white/15 bg-black/25 px-4"><LockKeyhole size={22} /><input type="password" className="flex-1 bg-transparent outline-none" defaultValue="GreenChoiceLocal123!" /></span></label>
            <button className="h-14 rounded-lg bg-lime-500 text-lg font-bold text-white" disabled>Cookie auth placeholder</button>
          </form>
          <div className="mt-6 rounded-lg border border-lime-400/25 bg-lime-400/10 p-4 text-sm text-white/75">
            <ShieldCheck className="mb-2 text-lime-400" />
            Sign-in, MFA enrollment, failed attempts and restricted access denials are captured as audit events.
          </div>
          <Link href="/register" className="mt-5 flex h-14 items-center justify-center gap-3 rounded-lg border border-white/15 bg-black/20 text-lg font-semibold"><UserRound className="text-lime-400" />Create customer account</Link>
        </GlassPanel>
      </section>
    </main>
  );
}
