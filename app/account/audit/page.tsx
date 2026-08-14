import { Activity, DatabaseBackup, FileClock } from "lucide-react";
import { GlassPanel } from "@/components/AccountChrome";
import { auditEvents } from "@/lib/account-data";
import { requirePermission } from "@/lib/dal/auth";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  await requirePermission("audit.view.tenant");
  return (
    <main className="mx-auto max-w-[1200px] px-4 py-8">
      <h1 className="text-4xl font-bold">Audit <span className="text-lime-400">Log</span></h1>
      <p className="mt-3 text-white/68">Structured compliance events for sensitive account, policy, export and access decisions.</p>
      <GlassPanel className="mt-8">
        <h2 className="flex items-center gap-2 text-2xl font-semibold"><FileClock className="text-lime-400" />Recent activity</h2>
        <div className="mt-5 overflow-hidden rounded-lg border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.06] text-white/60"><tr><th className="p-3">Time</th><th>Actor</th><th>Action</th><th>Target</th><th>Result</th></tr></thead>
            <tbody>{auditEvents.map((event) => <tr key={`${event.time}-${event.action}`} className="border-t border-white/10"><td className="p-3">{event.time}</td><td>{event.actor}</td><td className="text-lime-400">{event.action}</td><td>{event.target}</td><td>{event.result}</td></tr>)}</tbody>
          </table>
        </div>
      </GlassPanel>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <GlassPanel><Activity className="text-lime-400" /><h2 className="mt-3 text-xl font-semibold">Denied access</h2><p className="mt-2 text-white/65">Denied restricted catalog, cross-store and customer-record access is logged with actor, target, scope and reason.</p></GlassPanel>
        <GlassPanel id="backups"><DatabaseBackup className="text-lime-400" /><h2 className="mt-3 text-xl font-semibold">Backup overview</h2><p className="mt-2 text-white/65">Last backup: June 4, 2026 02:00. Next scheduled backup: June 5, 2026 02:00.</p></GlassPanel>
      </div>
    </main>
  );
}
