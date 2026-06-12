import { BackLink, DashboardHeader, GlassPanel, Money } from "@/components/GreenChoiceDashboard";
import { getSales } from "@/lib/greenchoice-api";

export const dynamic = "force-dynamic";

export default async function ManagerSalesPage() {
  const sales = (await getSales()).data;
  return (
    <main className="mx-auto max-w-[1500px] px-4 py-8">
      <BackLink href="/dashboard/manager" />
      <DashboardHeader title="Sales & Transactions" subtitle="View sales, transactions and order history." profileLabel="Manager profile" />
      <GlassPanel className="mb-5">
        <div className="grid gap-3 md:grid-cols-5">
          {["Date range", "Receptionist", "Payment status", "Sale status", "Category / search"].map((label) => <div key={label} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/55">{label}</div>)}
        </div>
      </GlassPanel>
      <div className="grid gap-4">
        {sales.length ? sales.map((sale) => (
          <GlassPanel key={sale.id} className="grid gap-4 md:grid-cols-[1.1fr_1fr_1fr_1fr] md:items-center">
            <div><p className="font-bold">{sale.transaction_number}</p><p className="text-sm text-white/55">{new Date(sale.created_at).toLocaleString()} · {sale.customerName || "No customer attached"}</p></div>
            <p>{sale.receptionistName || "Receptionist"}</p>
            <p>{sale.payment_status} · {sale.sale_status}</p>
            <p className="text-xl font-bold text-lime-300"><Money value={sale.total} /></p>
          </GlassPanel>
        )) : <GlassPanel><p className="text-white/65">No sales have been completed yet.</p></GlassPanel>}
      </div>
    </main>
  );
}
