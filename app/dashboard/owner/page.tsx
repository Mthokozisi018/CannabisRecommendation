import { BarChart3, BriefcaseBusiness, CircleDollarSign, ShieldCheck } from "lucide-react";
import { GlassPanel } from "@/components/AccountChrome";
import { requirePermission } from "@/lib/dal/auth";

export const dynamic = "force-dynamic";

export default async function OwnerDashboardPage() {
  await requirePermission("reports.view.tenant");
  return (
    <main className="mx-auto max-w-[1300px] px-4 py-8">
      <h1 className="text-4xl font-bold">Owner <span className="text-lime-400">Overview</span></h1>
      <p className="mt-3 text-white/68">Executive reporting, approvals and senior business controls without automatic platform-admin powers.</p>
      <div className="mt-8 grid gap-5 md:grid-cols-4">
        {[["Tenant Sales", "R 128,540", CircleDollarSign], ["Stores", "3", BriefcaseBusiness], ["Reports", "This month", BarChart3], ["Approvals", "2 pending", ShieldCheck]].map(([label, value, Icon]) => <GlassPanel key={label as string}><Icon className="text-lime-400" /><p className="mt-4 text-sm text-white/55">{label as string}</p><p className="mt-1 text-3xl font-bold">{value as string}</p></GlassPanel>)}
      </div>
    </main>
  );
}
