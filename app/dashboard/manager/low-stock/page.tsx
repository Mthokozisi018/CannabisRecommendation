import { BackLink, DashboardHeader, GlassPanel, VisualHeroPanel } from "@/components/GreenChoiceDashboard";
import { dashboardVisuals } from "@/lib/dashboard-visuals";
import { getManagerLowStockSummary } from "@/lib/manager/data";

export const dynamic = "force-dynamic";

export default async function ManagerLowStockPage() {
  const summary = await getManagerLowStockSummary();
  const cards = [
    { label: "Products tracked", value: summary.productCount },
    { label: "Low stock", value: summary.lowStockCount },
    { label: "Out of stock", value: summary.outOfStockCount },
    { label: "Expiring soon", value: summary.expiringSoonCount }
  ];

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-8">
      <BackLink href="/dashboard/manager" />
      <DashboardHeader title="Low Stock Alerts" subtitle="Low stock, out of stock and expiring inventory." profileLabel="Manager profile" />
      <VisualHeroPanel imageSrc={dashboardVisuals.manager.inventory} alt="GreenChoice low stock inventory visual" className="mb-5 min-h-[200px]">
        <p className="max-w-2xl text-3xl font-extrabold text-white">Stock Alerts</p>
        <p className="mt-3 max-w-2xl text-lg leading-7 text-white/72">Inventory risk stays visible against the same category-led dashboard style.</p>
      </VisualHeroPanel>
      <GlassPanel className="mb-5">
        <div className="grid gap-3 md:grid-cols-4">
          {cards.map((card) => (
            <div key={card.label} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
              <p className="text-sm text-white/55">{card.label}</p>
              <p className="mt-2 text-2xl font-extrabold text-white">{card.value}</p>
            </div>
          ))}
        </div>
      </GlassPanel>
      <GlassPanel>
        <p className="text-white/65">Low stock alert data is loaded from Supabase and cached briefly for browsing speed.</p>
        <p className="mt-2 text-sm text-white/40">Real-time inventory alerts coming in the next update.</p>
      </GlassPanel>
    </main>
  );
}
