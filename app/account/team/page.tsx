import { ShieldAlert, Store, UserPlus, UsersRound } from "lucide-react";
import { GlassPanel } from "@/components/AccountChrome";
import { requirePermission } from "@/lib/dal/auth";

export const dynamic = "force-dynamic";

const team = [
  ["Ava Mokoena", "Tenant Admin", "Tenant", "MFA enabled"],
  ["John Manager", "Manager", "GreenChoice Sandton", "Active"],
  ["Sarah Receptionist", "Receptionist", "GreenChoice Sandton", "Active"],
  ["Lerato Compliance", "Compliance Officer", "Tenant", "Policy access"]
];

export default async function TeamPage() {
  await requirePermission("team.manage.tenant");
  return (
    <main className="mx-auto max-w-[1200px] px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="text-4xl font-bold">Team <span className="text-lime-400">Access</span></h1><p className="mt-3 text-white/68">Tenant-scoped users with store-aware role assignments.</p></div>
        <button className="inline-flex h-12 items-center gap-2 rounded-lg bg-lime-500 px-5 font-bold text-white"><UserPlus />Invite user</button>
      </div>
      <GlassPanel className="mt-8">
        <h2 className="flex items-center gap-2 text-2xl font-semibold"><UsersRound className="text-lime-400" />Users</h2>
        <div className="mt-5 overflow-hidden rounded-lg border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.06] text-white/60"><tr><th className="p-3">User</th><th>Role</th><th>Scope</th><th>State</th></tr></thead>
            <tbody>{team.map((row) => <tr key={row[0]} className="border-t border-white/10"><td className="p-3 font-semibold">{row[0]}</td><td className="text-lime-400">{row[1]}</td><td>{row[2]}</td><td>{row[3]}</td></tr>)}</tbody>
          </table>
        </div>
      </GlassPanel>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <GlassPanel id="stores"><Store className="text-lime-400" /><h2 className="mt-3 text-xl font-semibold">Store scope</h2><p className="mt-2 text-white/65">Frontline staff are restricted to assigned stores. Cross-store customer and inventory access is denied by default.</p></GlassPanel>
        <GlassPanel id="appointments"><ShieldAlert className="text-lime-400" /><h2 className="mt-3 text-xl font-semibold">Sensitive actions</h2><p className="mt-2 text-white/65">Role changes, unlocks, exports and policy changes require step-up checks and audit notes.</p></GlassPanel>
      </div>
    </main>
  );
}
