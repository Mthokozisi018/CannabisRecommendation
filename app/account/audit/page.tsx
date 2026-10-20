import { Activity, DatabaseBackup, FileClock } from "lucide-react";
import { GlassPanel } from "@/components/AccountChrome";
import { requirePermission } from "@/lib/dal/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AuditRow = {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  result: string | null;
  created_at: string;
};

export default async function AuditPage() {
  await requirePermission("audit.view.tenant");
  const supabase = await createSupabaseServerClient();
  const { data, error } = supabase
    ? await supabase
      .from("audit_logs")
      .select("id,user_id,action,table_name,result,created_at")
      .order("created_at", { ascending: false })
      .limit(100)
    : { data: null, error: new Error("Supabase is unavailable") };
  if (error) throw new Error("Audit history is temporarily unavailable.");
  const auditEvents = (data ?? []) as AuditRow[];

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-8">
      <h1 className="text-4xl font-bold">Audit <span className="text-lime-400">Log</span></h1>
      <p className="mt-3 text-white/68">Structured compliance events for sensitive account, policy, export and access decisions.</p>
      <GlassPanel className="mt-8">
        <h2 className="flex items-center gap-2 text-2xl font-semibold"><FileClock className="text-lime-400" />Recent activity</h2>
        <div className="mt-5 overflow-hidden rounded-lg border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.06] text-white/60"><tr><th className="p-3">Time</th><th>Actor</th><th>Action</th><th>Target</th><th>Result</th></tr></thead>
            <tbody>
              {auditEvents.map((event) => (
                <tr key={event.id} className="border-t border-white/10">
                  <td className="p-3 whitespace-nowrap">{new Date(event.created_at).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })}</td>
                  <td className="font-mono text-xs">{event.user_id ? event.user_id.slice(0, 8) : "system"}</td>
                  <td className="text-lime-400">{event.action}</td>
                  <td>{event.table_name}</td>
                  <td>{event.result ?? "recorded"}</td>
                </tr>
              ))}
              {auditEvents.length === 0 ? <tr><td className="p-6 text-white/55" colSpan={5}>No authorized audit events are available.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </GlassPanel>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <GlassPanel><Activity className="text-lime-400" /><h2 className="mt-3 text-xl font-semibold">Denied access</h2><p className="mt-2 text-white/65">Denied restricted catalog, cross-store and customer-record access is logged with actor, target, scope and reason.</p></GlassPanel>
        <GlassPanel id="backups"><DatabaseBackup className="text-lime-400" /><h2 className="mt-3 text-xl font-semibold">Backup overview</h2><p className="mt-2 text-white/65">Backup recency is verified in the Supabase project before each production release. This application does not claim a backup exists without provider evidence.</p></GlassPanel>
      </div>
    </main>
  );
}
