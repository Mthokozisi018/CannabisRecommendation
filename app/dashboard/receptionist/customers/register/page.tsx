import { BackLink, DashboardHeader, GlassPanel, VisualHeroPanel } from "@/components/GreenChoiceDashboard";
import { dashboardVisuals } from "@/lib/dashboard-visuals";

export default function RegisterCustomerRecordPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <BackLink href="/dashboard/receptionist/products" visualStyle="receptionist" />
      <DashboardHeader title="Register Customer Record" subtitle="Create a customer record for sale history. Customers do not log in." profileLabel="Receptionist profile" />
      <VisualHeroPanel imageSrc={dashboardVisuals.receptionist.customerSignIn} alt="GreenChoice customer registration visual" className="mb-6 min-h-[260px]">
        <p className="max-w-xl text-3xl font-extrabold text-white">Customer Details</p>
        <p className="mt-3 max-w-xl text-lg leading-7 text-white/72">Capture sale history details for in-store staff workflows.</p>
      </VisualHeroPanel>
      <GlassPanel>
        <form className="grid gap-4 md:grid-cols-2">
          {["First name", "Surname", "Mobile number", "Email, optional", "Location, optional"].map((label) => (
            <label key={label} className="block text-sm font-semibold text-white/80">
              {label}
              <input className="mt-2 h-12 w-full rounded-xl border border-white/12 bg-black/25 px-4 outline-none focus:border-lime-300" />
            </label>
          ))}
          <label className="block text-sm font-semibold text-white/80 md:col-span-2">
            Customer note, optional
            <textarea className="mt-2 min-h-28 w-full rounded-xl border border-white/12 bg-black/25 px-4 py-3 outline-none focus:border-lime-300" />
          </label>
          <label className="flex items-start gap-3 text-white/70 md:col-span-2"><input type="checkbox" className="mt-1 size-5" />Age/legal eligibility verified according to store policy.</label>
          <label className="flex items-start gap-3 text-white/70 md:col-span-2"><input type="checkbox" className="mt-1 size-5" />Consent to store customer details.</label>
          <button className="h-12 rounded-xl bg-lime-500 font-bold text-white md:col-span-2">Create Customer Record</button>
        </form>
      </GlassPanel>
    </main>
  );
}
