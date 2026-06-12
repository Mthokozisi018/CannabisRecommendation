import { BackLink, DashboardHeader, GlassPanel } from "@/components/GreenChoiceDashboard";

export default function RegisterCustomerRecordPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <BackLink href="/dashboard/receptionist/products" />
      <DashboardHeader title="Register Customer Record" subtitle="Create a customer record for sale history. Customers do not log in." profileLabel="Receptionist profile" />
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
