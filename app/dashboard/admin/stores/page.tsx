import { ChevronDown } from "lucide-react";
import { DeleteStoreButton } from "@/components/admin/DeleteStoreButton";
import { AdminPageShell, StatusBadge } from "@/components/admin/AdminDashboardUI";
import { getAdminStores } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

function MemberTable({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="text-xl font-extrabold text-lime-400">{title}</h3>
      {children || <p className="mt-3 rounded-lg border border-lime-400/20 px-4 py-4 text-white/65">{empty}</p>}
    </section>
  );
}

export default async function StoresAndManagersPage() {
  const stores = await getAdminStores();

  return (
    <AdminPageShell>
      <section className="rounded-2xl border border-lime-400/45 bg-[linear-gradient(145deg,rgba(4,35,18,0.72),rgba(0,8,7,0.84))] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.38)] sm:p-10">
        <h1 className="text-4xl font-extrabold sm:text-5xl">View Stores & Managers</h1>
        <p className="mt-4 text-lg text-white/75">View every store and the managers and staff connected to that store.</p>
        <div className="mt-8 overflow-hidden rounded-xl border border-lime-400/35">
          <div className="grid grid-cols-[100px_1fr_110px_110px_80px] gap-4 border-b border-lime-400/30 bg-black/25 px-6 py-4 font-bold text-lime-400">
            <span>Delete</span>
            <span>Store Name</span>
            <span>Managers</span>
            <span>Staff</span>
            <span>Open</span>
          </div>
          {stores.length === 0 ? <p className="px-6 py-8 text-white/72">No stores found.</p> : null}
          {stores.map((store) => (
            <details key={store.id} className="group border-b border-lime-400/20 last:border-b-0">
              <summary className="grid cursor-pointer list-none grid-cols-[100px_1fr_110px_110px_80px] gap-4 px-6 py-5 text-lg font-bold [&::-webkit-details-marker]:hidden">
                <DeleteStoreButton storeId={store.id} storeName={store.name} />
                <span>{store.name}</span>
                <span>{store.managers.length}</span>
                <span>{store.receptionists.length}</span>
                <ChevronDown className="transition group-open:rotate-180" />
              </summary>
              <div className="mx-5 mb-5 rounded-xl border border-lime-400/25 bg-black/25 p-5">
                <p className="text-sm font-bold text-lime-400">Store Name</p>
                <h2 className="mt-2 text-2xl font-extrabold">{store.name}</h2>
                <p className="mt-1 text-white/65">{store.address}</p>
                <StatusBadge status={store.accessStatus} />

                <MemberTable title="Managers" empty="No managers connected to this store.">
                  {store.managers.length > 0 ? (
                    <div className="mt-3 overflow-hidden rounded-lg border border-lime-400/25">
                      <div className="grid grid-cols-3 border-b border-lime-400/25 px-4 py-3 font-bold text-lime-400">
                        <span>Manager Name</span>
                        <span>Email</span>
                        <span>Account Status</span>
                      </div>
                      {store.managers.map((manager) => (
                        <div key={manager.email} className="grid grid-cols-3 gap-3 border-b border-lime-400/15 px-4 py-3 last:border-b-0">
                          <span>{manager.name}</span>
                          <span>{manager.email}</span>
                          <StatusBadge status={manager.status} />
                        </div>
                      ))}
                    </div>
                  ) : null}
                </MemberTable>

                <MemberTable title="Staff / Receptionists" empty="No staff connected to this store.">
                  {store.receptionists.length > 0 ? (
                    <div className="mt-3 overflow-hidden rounded-lg border border-lime-400/25">
                      <div className="grid grid-cols-4 border-b border-lime-400/25 px-4 py-3 font-bold text-lime-400">
                        <span>Staff Name</span>
                        <span>Email</span>
                        <span>Role</span>
                        <span>Account Status</span>
                      </div>
                      {store.receptionists.map((staff) => (
                        <div key={staff.email} className="grid grid-cols-4 gap-3 border-b border-lime-400/15 px-4 py-3 last:border-b-0">
                          <span>{staff.name}</span>
                          <span>{staff.email}</span>
                          <span>Receptionist</span>
                          <StatusBadge status={staff.status} />
                        </div>
                      ))}
                    </div>
                  ) : null}
                </MemberTable>
              </div>
            </details>
          ))}
        </div>
      </section>
    </AdminPageShell>
  );
}
