import { BackLink, DashboardHeader, GlassPanel, VisualHeroPanel } from "@/components/GreenChoiceDashboard";
import { dashboardVisuals } from "@/lib/dashboard-visuals";

export default function ReceptionistCheckoutPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <BackLink href="/dashboard/receptionist/products" visualStyle="receptionist" />
      <DashboardHeader title="Checkout" subtitle="Final sale summary and payment confirmation placeholder." profileLabel="Receptionist profile" />
      <VisualHeroPanel imageSrc={dashboardVisuals.receptionist.dashboard} alt="GreenChoice receptionist checkout visual" className="mb-6 min-h-[220px]">
        <p className="max-w-2xl text-3xl font-extrabold text-white">Checkout</p>
        <p className="mt-3 max-w-2xl text-lg leading-7 text-white/72">Finalize assisted in-store sales from the receptionist workstation.</p>
      </VisualHeroPanel>
      <GlassPanel>
        <p className="text-white/68">Checkout completion will run as a backend atomic operation: validate cart, verify customer eligibility, reduce stock, create stock movements, create transaction records, then refresh dashboard data.</p>
      </GlassPanel>
    </main>
  );
}
