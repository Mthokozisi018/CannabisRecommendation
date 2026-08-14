import { ShieldAlert } from "lucide-react";
import { DashboardBackdrop } from "@/components/GreenChoiceDashboard";
import { getDashboardSession } from "@/lib/dashboard-session";

export const dynamic = "force-dynamic";

export default async function ReceptionistRestrictedPage() {
  await getDashboardSession();
  return (
    <main className="relative isolate grid min-h-screen place-items-center px-4 py-10 text-white">
      <DashboardBackdrop variant="admin" />
      <section className="w-full max-w-3xl rounded-2xl border border-lime-400/45 bg-[linear-gradient(145deg,rgba(4,35,18,0.76),rgba(0,8,7,0.88))] p-8 text-center shadow-[0_28px_90px_rgba(0,0,0,0.38)]">
        <span className="mx-auto grid size-24 place-items-center rounded-full border border-red-400/55 bg-red-500/10 text-red-300">
          <ShieldAlert size={48} />
        </span>
        <h1 className="mt-7 text-4xl font-extrabold">Access Restricted</h1>
        <p className="mx-auto mt-5 max-w-2xl text-xl leading-8 text-white/78">Your access to the receptionist dashboard has been restricted. You do not have permission to access the system at this time.</p>
        <div className="mx-auto mt-8 max-w-xl rounded-xl border border-lime-400/30 bg-black/25 p-6">
          <h2 className="text-2xl font-extrabold text-lime-400">Please Contact Your Manager</h2>
          <p className="mt-3 text-white/75">For any questions or to restore your access, please contact your store manager.</p>
        </div>
      </section>
    </main>
  );
}
