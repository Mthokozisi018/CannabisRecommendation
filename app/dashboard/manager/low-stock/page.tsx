import { BackLink, DashboardHeader, GlassPanel, Money } from "@/components/GreenChoiceDashboard";
import { getLowStockRows } from "@/lib/greenchoice-api";

export const dynamic = "force-dynamic";

export default async function ManagerLowStockPage() {
  const rows = (await getLowStockRows()).data;
  return (
    <main className="mx-auto max-w-[1500px] px-4 py-8">
      <BackLink href="/dashboard/manager" />
      <DashboardHeader title="Low Stock Alerts" subtitle="Low stock, out of stock and expiring inventory." profileLabel="Manager profile" />
      <GlassPanel className="mb-5">
        <div className="grid gap-3 md:grid-cols-4">{["Category", "Low stock", "Out of stock", "Expiring soon"].map((label) => <div key={label} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/55">{label}</div>)}</div>
      </GlassPanel>
      <div className="grid gap-4">
        {rows.map((row) => (
          <GlassPanel key={row.id} className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_1fr_1fr] md:items-center">
            <div><p className="font-bold">{row.productName}</p><p className="text-sm text-white/55">{row.category}</p></div>
            <p>{row.status.replaceAll("_", " ")}</p>
            <p>{row.quantityAvailable} / threshold {row.lowStockThreshold}</p>
            <p><Money value={row.estimatedStockValue} /></p>
            <p className="text-sm text-white/55">{new Date(row.lastUpdated).toLocaleDateString()}</p>
          </GlassPanel>
        ))}
      </div>
    </main>
  );
}
