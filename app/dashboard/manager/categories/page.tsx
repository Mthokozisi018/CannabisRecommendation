import { BackLink, DashboardHeader, GlassPanel, VisualHeroPanel } from "@/components/GreenChoiceDashboard";
import { dashboardVisuals } from "@/lib/dashboard-visuals";

export const dynamic = "force-dynamic";

export default async function ManagerCategoriesPage() {
  return (
    <main className="mx-auto max-w-[1500px] px-4 py-8">
      <BackLink href="/dashboard/manager" />
      <DashboardHeader title="Categories" subtitle="View categories, manage names, icons and active status." profileLabel="Manager profile" />
      <VisualHeroPanel imageSrc={dashboardVisuals.manager.inventory} alt="GreenChoice category inventory visual" className="mb-5 min-h-[200px]">
        <p className="max-w-2xl text-3xl font-extrabold text-white">Inventory by Category</p>
        <p className="mt-3 max-w-2xl text-lg leading-7 text-white/72">Category controls use the same product grouping shown in the dashboard visuals.</p>
      </VisualHeroPanel>
      <GlassPanel className="mb-5">
        <button className="rounded-xl bg-lime-500 px-4 py-2 font-bold text-white">Add category</button>
      </GlassPanel>
      <GlassPanel>
        <p className="text-white/65">Category management is being migrated to Supabase.</p>
        <p className="mt-2 text-sm text-white/40">Category list and management coming in the next update.</p>
      </GlassPanel>
    </main>
  );
}
