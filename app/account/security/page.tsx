import { KeyRound, LockKeyhole, MonitorSmartphone, ShieldCheck } from "lucide-react";
import { GlassPanel } from "@/components/AccountChrome";
import { customerContext } from "@/lib/account-data";
import { assertPermission } from "@/lib/authorization";

export default function AccountSecurityPage() {
  assertPermission(customerContext, "account.security.manage", { ownerUserId: customerContext.userId });
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-4xl font-bold">Account <span className="text-lime-400">Security</span></h1>
      <p className="mt-3 text-white/68">Manage MFA, active sessions and recent security activity.</p>
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {[
          ["MFA", "Not enrolled", ShieldCheck],
          ["Password policy", "Strong", LockKeyhole],
          ["Session timeout", "30 min", KeyRound]
        ].map(([title, value, Icon]) => <GlassPanel key={title as string}><Icon className="text-lime-400" /><h2 className="mt-4 text-xl font-semibold">{title as string}</h2><p className="mt-2 text-lime-400">{value as string}</p></GlassPanel>)}
      </div>
      <GlassPanel className="mt-6">
        <h2 className="flex items-center gap-2 text-2xl font-semibold"><MonitorSmartphone className="text-lime-400" />Sessions and devices</h2>
        <div className="mt-5 space-y-3">
          {["Current browser - Johannesburg - active now", "Mobile Safari - Cape Town - May 20, 2026", "Support session - revoked - May 18, 2026"].map((item) => <div key={item} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">{item}</div>)}
        </div>
      </GlassPanel>
    </main>
  );
}
