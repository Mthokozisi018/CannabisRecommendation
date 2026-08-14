import { BackLink, DashboardHeader, GlassPanel, VisualHeroPanel } from "@/components/GreenChoiceDashboard";
import { dashboardVisuals } from "@/lib/dashboard-visuals";

export const dynamic = "force-dynamic";

export default async function ManagerPromotionsPage() {
  return (
    <main className="mx-auto max-w-[1500px] px-4 py-8">
      <BackLink href="/dashboard/manager" />
      <DashboardHeader title="Promotions & Discounts" subtitle="Create and manage promotions and discounts." profileLabel="Manager profile" />
      <VisualHeroPanel imageSrc={dashboardVisuals.manager.dashboard} alt="GreenChoice promotions visual" className="mb-5 min-h-[200px]">
        <p className="max-w-2xl text-3xl font-extrabold text-white">Promotions & Discounts</p>
        <p className="mt-3 max-w-2xl text-lg leading-7 text-white/72">Campaign controls retain the GreenChoice dark glass workstation look.</p>
      </VisualHeroPanel>
      <GlassPanel className="mb-5">
        <button className="rounded-xl bg-lime-500 px-4 py-2 font-bold text-white">Create promotion</button>
      </GlassPanel>
      <GlassPanel>
        <p className="text-white/65">Promotions data is being migrated to Supabase.</p>
        <p className="mt-2 text-sm text-white/40">Campaign management tools coming in the next update.</p>
      </GlassPanel>
    </main>
  );
}
