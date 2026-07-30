import { Ban, CheckCircle2, Store } from "lucide-react";
import { AdminPageShell, StatusBadge } from "@/components/admin/AdminDashboardUI";
import { getStoreAccessRows } from "@/lib/admin/data";
import { updateStoreAccessAction } from "@/app/dashboard/admin/actions";

export const dynamic = "force-dynamic";

export default async function PaymentsAndSubscriptionsPage() {
  const stores = await getStoreAccessRows();

  return (
    <AdminPageShell>
      <section className="rounded-2xl border border-lime-400/45 bg-[linear-gradient(145deg,rgba(4,35,18,0.72),rgba(0,8,7,0.84))] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.38)] sm:p-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <span className="grid size-24 place-items-center rounded-full border border-lime-400/45 bg-lime-400/10 text-lime-300">
            <Store size={46} />
          </span>
          <div>
            <h1 className="text-4xl font-extrabold sm:text-5xl">Payments & Subscriptions</h1>
            <p className="mt-4 text-lg text-white/75">View all stores and manage their software access status.</p>
          </div>
        </div>
        <div className="mt-8 overflow-hidden rounded-xl border border-lime-400/35">
          <div className="grid grid-cols-[1fr_1.35fr_180px_280px] gap-4 border-b border-lime-400/30 bg-black/25 px-6 py-5 text-lg font-bold text-lime-400">
            <span>Store Name</span>
            <span>Address</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          {stores.length === 0 ? <p className="px-6 py-8 text-white/72">No stores found.</p> : null}
          {stores.map((store) => (
            <div key={store.id} className="grid grid-cols-1 gap-4 border-b border-lime-400/20 px-6 py-5 last:border-b-0 lg:grid-cols-[1fr_1.35fr_180px_280px] lg:items-center">
              <span className="font-bold">{store.name}</span>
              <span className="leading-7 text-white/78">{store.address}</span>
              <StatusBadge status={store.accessStatus} />
              <div className="flex flex-wrap gap-3">
                <form action={updateStoreAccessAction}>
                  <input type="hidden" name="storeId" value={store.id} />
                  <input type="hidden" name="accessStatus" value="active" />
                  <button className="inline-flex h-11 items-center gap-2 rounded-lg border border-lime-400/65 px-4 font-bold text-lime-300 transition hover:bg-lime-400/10 disabled:opacity-45" type="submit" disabled={store.accessStatus === "active"}>
                    <CheckCircle2 size={18} />
                    Activate
                  </button>
                </form>
                <form action={updateStoreAccessAction}>
                  <input type="hidden" name="storeId" value={store.id} />
                  <input type="hidden" name="accessStatus" value="restricted" />
                  <button className="inline-flex h-11 items-center gap-2 rounded-lg border border-red-400/75 px-4 font-bold text-red-300 transition hover:bg-red-500/10 disabled:opacity-45" type="submit" disabled={store.accessStatus === "restricted"}>
                    <Ban size={18} />
                    Restrict
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </section>
    </AdminPageShell>
  );
}
