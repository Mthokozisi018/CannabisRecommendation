import { BackLink, DashboardHeader, GlassPanel, VisualHeroPanel } from "@/components/GreenChoiceDashboard";
import { dashboardVisuals } from "@/lib/dashboard-visuals";

export const dynamic = "force-dynamic";

export default async function ManagerSalesPage() {
  return (
    <main className="mx-auto max-w-[1500px] px-4 py-8">
      <BackLink href="/dashboard/manager" />
      <DashboardHeader title="Sales & Transactions" subtitle="View sales, transactions and order history." profileLabel="Manager profile" />
      <VisualHeroPanel imageSrc={dashboardVisuals.manager.dashboard} alt="GreenChoice sales dashboard visual" className="mb-5 min-h-[200px]">
        <p className="max-w-2xl text-3xl font-extrabold text-white">Sales & Transactions</p>
        <p className="mt-3 max-w-2xl text-lg leading-7 text-white/72">Transaction history stays in the manager-only dashboard environment.</p>
      </VisualHeroPanel>
      <GlassPanel className="mb-5">
        <div className="grid gap-3 md:grid-cols-5">
          {["Date range", "Receptionist", "Payment status", "Sale status", "Category / search"].map((label) => <div key={label} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/55">{label}</div>)}
        </div>
      </GlassPanel>
      <GlassPanel>
        <p className="text-white/65">Sales data is being migrated to Supabase.</p>
        <p className="mt-2 text-sm text-white/40">This feature is coming in the next update.</p>
      </GlassPanel>
    </main>
  );
}
