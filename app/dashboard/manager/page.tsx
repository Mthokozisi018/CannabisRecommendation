import Link from "next/link";
import { Package, UsersRound, BarChart3, ShieldCheck } from "lucide-react";
import { GlassPanel } from "@/components/AccountChrome";
import { requirePermission } from "@/lib/dal/auth";

export const dynamic = "force-dynamic";

export default async function ManagerDashboardPage() {
  await requirePermission("inventory.manage.store");
  return (
    <main className="mx-auto max-w-[1300px] px-4 py-8">
      <h1 className="text-4xl font-bold">Welcome back, <span className="text-lime-400">Manager</span></h1>
      <p className="mt-3 text-white/68">Manage assigned-store inventory, reports, service escalations and frontline access.</p>
      <div className="mt-8 grid gap-5 md:grid-cols-4">
        {[["Total Products", "356", Package], ["Low Stock", "18", ShieldCheck], ["Customers Served", "42", UsersRound], ["Store Reports", "Ready", BarChart3]].map(([label, value, Icon]) => <GlassPanel key={label as string}><Icon className="text-lime-400" /><p className="mt-4 text-sm text-white/55">{label as string}</p><p className="mt-1 text-3xl font-bold">{value as string}</p></GlassPanel>)}
      </div>
      <Link href="/admin/products" className="mt-6 inline-flex h-12 items-center rounded-lg bg-lime-500 px-5 font-bold text-white">Open inventory</Link>
    </main>
  );
}
