import Link from "next/link";
import { Activity, DatabaseBackup, Settings, UserCog } from "lucide-react";
import { GlassPanel } from "@/components/AccountChrome";
import { requirePermission } from "@/lib/dal/auth";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requirePermission("settings.manage.tenant");
  return (
    <main className="mx-auto max-w-[1300px] px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="text-4xl font-bold">Welcome back, <span className="text-lime-400">Admin</span></h1><p className="mt-3 text-white/68">Manage tenant settings, user access, security and compliance operations.</p></div>
        <Link href="/account/roles" className="inline-flex h-12 items-center rounded-lg bg-lime-500 px-5 font-bold text-white">System settings</Link>
      </div>
      <div className="mt-8 grid gap-5 md:grid-cols-4">
        {[["Users", "32", UserCog], ["Audit events", "128", Activity], ["Backups", "Healthy", DatabaseBackup], ["Security", "Strong", Settings]].map(([label, value, Icon]) => <GlassPanel key={label as string}><Icon className="text-lime-400" /><p className="mt-4 text-sm text-white/55">{label as string}</p><p className="mt-1 text-3xl font-bold">{value as string}</p></GlassPanel>)}
      </div>
    </main>
  );
}
