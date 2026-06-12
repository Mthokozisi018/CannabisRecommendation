import { BackLink, DashboardHeader, GlassPanel } from "@/components/GreenChoiceDashboard";
import { getStaffAccounts } from "@/lib/greenchoice-api";

export const dynamic = "force-dynamic";

const managerCan = ["Access manager dashboard", "Manage products", "Manage inventory", "View all sales and transactions", "Manage staff/receptionists", "Manage categories", "Manage promotions", "View low stock alerts"];
const receptionistCan = ["Access receptionist dashboard", "Browse products", "View available stock", "Register/search customer records", "Add products to cart", "Create sales", "Complete checkout", "View own sales activity later"];
const receptionistCannot = ["Access manager dashboard", "Create staff accounts", "Delete/archive products", "Manage categories", "View full reports", "View all store sales", "Manage promotions", "Change system settings"];

export default async function ManagerStaffPage() {
  const staff = (await getStaffAccounts()).data;
  return (
    <main className="mx-auto max-w-[1500px] px-4 py-8">
      <BackLink href="/dashboard/manager" />
      <DashboardHeader title="Staff / Receptionists" subtitle="View and manage staff accounts." profileLabel="Manager profile" />
      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <GlassPanel>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-bold">Staff accounts</h2>
            <button className="rounded-xl bg-lime-500 px-4 py-2 font-bold text-white">Create receptionist</button>
          </div>
          <div className="grid gap-3">
            {staff.map((person) => (
              <div key={person.id} className="grid gap-2 rounded-xl border border-white/10 bg-black/20 p-4 md:grid-cols-4">
                <p className="font-semibold">{person.fullName}</p>
                <p className="text-white/60">{person.email}</p>
                <p className="text-lime-300">{person.role}</p>
                <p className={person.is_active ? "text-lime-300" : "text-red-300"}>{person.is_active ? "Active" : "Inactive"}</p>
              </div>
            ))}
          </div>
        </GlassPanel>
        <GlassPanel>
          <h2 className="text-2xl font-bold">Role permissions</h2>
          <p className="mt-4 font-semibold text-lime-300">MANAGER can</p>
          <ul className="mt-2 space-y-1 text-sm text-white/62">{managerCan.map((item) => <li key={item}>{item}</li>)}</ul>
          <p className="mt-5 font-semibold text-lime-300">RECEPTIONIST can</p>
          <ul className="mt-2 space-y-1 text-sm text-white/62">{receptionistCan.map((item) => <li key={item}>{item}</li>)}</ul>
          <p className="mt-5 font-semibold text-red-200">RECEPTIONIST cannot</p>
          <ul className="mt-2 space-y-1 text-sm text-white/62">{receptionistCannot.map((item) => <li key={item}>{item}</li>)}</ul>
        </GlassPanel>
      </div>
    </main>
  );
}
