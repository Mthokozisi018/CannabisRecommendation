import { ShieldCheck, UsersRound } from "lucide-react";
import { AdminDemoManagerFeaturePage } from "@/components/admin/AdminDemoManagerFeaturePage";
import { DashboardCard } from "@/components/GreenChoiceDashboard";

export const dynamic = "force-dynamic";

export default function AdminDemoManagerStaffPage() {
  return (
    <AdminDemoManagerFeaturePage title="Manage Staff" subtitle="Demo staff management is Admin-controlled so no real receptionist auth users are created during walkthroughs.">
      <section className="flex min-h-56 flex-col justify-between rounded-2xl border border-lime-400/25 bg-white/[0.055] p-6 shadow-[0_22px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <span className="grid size-14 place-items-center rounded-2xl bg-lime-400/12 text-lime-300 shadow-[0_0_28px_rgba(132,229,89,0.18)]">
          <ShieldCheck size={30} />
        </span>
        <span>
          <span className="block text-2xl font-bold text-white">Demo Staff Policy</span>
          <span className="mt-2 block text-sm leading-6 text-white/58">The Admin account can demonstrate manager and receptionist workflows without creating staff logins for the demo store.</span>
        </span>
      </section>
      <DashboardCard title="Open Demo Receptionist POS" text="Use the Admin-controlled receptionist view for customer service demonstrations." href="/dashboard/admin/demo-store/receptionist" icon={UsersRound} />
    </AdminDemoManagerFeaturePage>
  );
}
