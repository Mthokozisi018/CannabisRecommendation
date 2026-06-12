import { BackLink, DashboardHeader, GlassPanel } from "@/components/GreenChoiceDashboard";

export default function ReceptionistCheckoutPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <BackLink href="/dashboard/receptionist/products" />
      <DashboardHeader title="Checkout" subtitle="Final sale summary and payment confirmation placeholder." profileLabel="Receptionist profile" />
      <GlassPanel>
        <p className="text-white/68">Checkout completion will run as a backend atomic operation: validate cart, verify customer eligibility, reduce stock, create stock movements, create transaction records, then refresh dashboard data.</p>
      </GlassPanel>
    </main>
  );
}
