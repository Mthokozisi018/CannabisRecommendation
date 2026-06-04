import { KeyRound, ShieldCheck } from "lucide-react";
import { requestRoleChangeAction } from "@/app/actions";
import { GlassPanel } from "@/components/AccountChrome";
import { requirePermission } from "@/lib/dal/auth";
import { roleLabels, visibleRolesForTenantPicker } from "@/lib/authorization";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  await requirePermission("roles.manage.tenant");
  const roles = visibleRolesForTenantPicker();
  return (
    <main className="mx-auto max-w-[1200px] px-4 py-8">
      <h1 className="text-4xl font-bold">Role <span className="text-lime-400">Management</span></h1>
      <p className="mt-3 text-white/68">Tenant-facing roles only. Platform super admin is internal and hidden from this picker.</p>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <GlassPanel>
          <h2 className="flex items-center gap-2 text-2xl font-semibold"><KeyRound className="text-lime-400" />Permission bundles</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {roles.map((role) => <div key={role} className="rounded-lg border border-white/10 bg-white/[0.035] p-4"><h3 className="font-semibold text-lime-400">{roleLabels[role]}</h3><p className="mt-2 text-sm text-white/62">Scoped access resolves against tenant, store, account state and restriction class.</p></div>)}
          </div>
        </GlassPanel>
        <GlassPanel>
          <h2 className="text-2xl font-semibold">Request role change</h2>
          <form action={requestRoleChangeAction} className="mt-5 grid gap-4">
            <label className="text-sm">Target role<select name="role" className="mt-2 h-12 w-full rounded-lg border border-white/15 bg-black/30 px-3"><option value="employee_receptionist">Receptionist</option><option value="manager">Manager</option><option value="compliance_officer">Compliance Officer</option></select></label>
            <label className="text-sm">Reason<textarea name="reason" className="mt-2 min-h-28 w-full rounded-lg border border-white/15 bg-black/30 p-3" defaultValue="Operational access review." /></label>
            <button className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-lime-500 font-bold text-white"><ShieldCheck />Log step-up request</button>
          </form>
        </GlassPanel>
      </div>
    </main>
  );
}
