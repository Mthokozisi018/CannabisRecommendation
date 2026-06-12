import { Boxes, CircleAlert, PackageCheck, WalletCards } from "lucide-react";
import { BackLink, DashboardHeader, GlassPanel, Money } from "@/components/GreenChoiceDashboard";
import { getInventorySummary } from "@/lib/greenchoice-api";

export const dynamic = "force-dynamic";

export default async function ManagerInventoryPage() {
  const inventory = (await getInventorySummary()).data;
  return (
    <main className="mx-auto max-w-[1500px] px-4 py-8">
      <BackLink href="/dashboard/manager" />
      <DashboardHeader title="Inventory" subtitle="Live inventory totals by category." profileLabel="Manager profile" />
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <GlassPanel><PackageCheck className="text-lime-300" /><p className="mt-3 text-sm text-white/55">Total stock units</p><p className="text-3xl font-bold">{inventory.totalStockUnits}</p></GlassPanel>
        <GlassPanel><WalletCards className="text-lime-300" /><p className="mt-3 text-sm text-white/55">Total estimated stock value</p><p className="text-3xl font-bold"><Money value={inventory.totalEstimatedStockValue} /></p></GlassPanel>
        <GlassPanel><CircleAlert className="text-lime-300" /><p className="mt-3 text-sm text-white/55">Low stock count</p><p className="text-3xl font-bold">{inventory.lowStockCount}</p></GlassPanel>
        <GlassPanel><Boxes className="text-lime-300" /><p className="mt-3 text-sm text-white/55">Out of stock count</p><p className="text-3xl font-bold">{inventory.outOfStockCount}</p></GlassPanel>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {inventory.categories.map((category) => (
          <GlassPanel key={category.slug} className="min-h-44">
            <p className="text-lg font-bold">{category.name}</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div><p className="text-sm text-white/55">Total units</p><p className="text-3xl font-bold text-lime-300">{category.totalUnits}</p></div>
              <div><p className="text-sm text-white/55">Estimated Value</p><p className="text-2xl font-bold"><Money value={category.estimatedValue} /></p></div>
            </div>
          </GlassPanel>
        ))}
      </div>
    </main>
  );
}
