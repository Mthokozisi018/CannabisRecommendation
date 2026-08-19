import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, ReceiptText, TrendingUp, Users } from "lucide-react";
import { DashboardAccountPanel } from "@/components/account/DashboardAccountMenu";
import type { DashboardAccountProfile } from "@/components/account/account-types";
import { Money } from "@/components/GreenChoiceDashboard";
import type { DashboardSession } from "@/lib/dashboard-session";
import { requireCompletedManagerDashboardSession } from "@/lib/manager/onboarding";
import { getManagerSalesOverview } from "@/lib/manager/sales-overview";

export const dynamic = "force-dynamic";

function firstName(displayName: string) {
  return displayName.trim().split(/\s+/)[0] || "Manager";
}

function accountProfileFromSession(session: DashboardSession): DashboardAccountProfile {
  return {
    firstName: session.profile.first_name ?? firstName(session.displayName),
    surname: session.profile.surname ?? "",
    email: session.email,
    phoneNumber: session.profile.phone_number ?? session.profile.mobile_number ?? "",
    alternativePhone: session.profile.alternative_phone ?? "",
    physicalAddress: session.profile.physical_address ?? "",
    city: session.profile.city ?? "",
    province: session.profile.province ?? "",
    postalCode: session.profile.postal_code ?? "",
    country: session.profile.country ?? "South Africa",
    employeeId: session.profile.employee_id ?? ""
  };
}

function formatSaleDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function formatSaleTime(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(date);
}

function displayPhone(phoneNumber: string | null) {
  if (!phoneNumber) return null;
  const digits = phoneNumber.replace(/\D/g, "");
  if (/^27[0-9]{9}$/.test(digits)) {
    const local = `0${digits.slice(2)}`;
    return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }
  return phoneNumber;
}

export default async function ManagerSalesPage({
  searchParams
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await requireCompletedManagerDashboardSession();
  const params = await searchParams;
  const parsedPage = Number.parseInt(params.page ?? "1", 10);
  const overview = await getManagerSalesOverview(session, Number.isFinite(parsedPage) ? parsedPage : 1);

  return (
    <main className="relative min-h-screen bg-[#020503] px-4 pb-10 pt-20 text-white sm:px-6 sm:pt-8 lg:px-10">
      <div className="absolute right-4 top-4 z-30 sm:right-6 sm:top-6">
        <DashboardAccountPanel role="manager" profile={accountProfileFromSession(session)} />
      </div>

      <div className="mx-auto w-full max-w-[1540px]">
        <Link href="/dashboard/manager" className="inline-flex h-10 items-center gap-2 rounded-xl border-2 border-white/20 bg-[#07100c] px-4 text-sm font-bold text-white/78 transition hover:border-emerald-300/60 hover:text-emerald-200">
          <ChevronLeft size={17} /> Back to Manager Dashboard
        </Link>

        <header className="mt-7 border-b border-white/15 pb-6">
          <p className="text-sm font-bold text-emerald-300">{session.storeName}</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Sales Overview</h1>
              <p className="mt-2 text-white/58">Store performance, registered customers and completed POS sales.</p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.13em] text-emerald-200">
              <ReceiptText size={14} /> Manager only
            </div>
          </div>
        </header>

        <section className="mt-7 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border-2 border-white/18 bg-[linear-gradient(145deg,#101714,#07100c)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-3 text-white/70"><span className="grid size-11 place-items-center rounded-full bg-emerald-400/12 text-emerald-300"><Users size={21} /></span><span className="font-bold">Total Customers</span></div>
            <p className="mt-5 text-4xl font-black text-emerald-400">{overview.totalCustomers.toLocaleString("en-ZA")}</p>
            <p className="mt-2 text-sm text-white/48">Registered with this store</p>
          </div>

          <div className="rounded-2xl border-2 border-white/18 bg-[linear-gradient(145deg,#101714,#07100c)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-3 text-white/70"><span className="grid size-11 place-items-center rounded-full bg-emerald-400/12 text-emerald-300"><TrendingUp size={21} /></span><span className="font-bold">Revenue This Week</span></div>
            <p className="mt-5 text-4xl font-black text-emerald-400"><Money value={overview.revenueThisWeek} /></p>
            <p className="mt-2 text-sm text-white/48">Completed sales from Monday to today</p>
          </div>

          <div className="rounded-2xl border-2 border-white/18 bg-[linear-gradient(145deg,#101714,#07100c)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-3 text-white/70"><span className="grid size-11 place-items-center rounded-full bg-emerald-400/12 text-emerald-300"><CalendarDays size={21} /></span><span className="font-bold">Today&apos;s Sales</span></div>
            <p className="mt-5 text-4xl font-black text-emerald-400"><Money value={overview.salesToday} /></p>
            <p className="mt-2 text-sm text-white/48">Completed today</p>
          </div>
        </section>

        <section className="mt-9">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-black">All Sales Transactions</h2>
              <p className="mt-1 text-sm text-white/48">{overview.totalSales.toLocaleString("en-ZA")} completed transaction{overview.totalSales === 1 ? "" : "s"}</p>
            </div>
            <p className="text-sm font-semibold text-white/45">Page {overview.currentPage} of {overview.totalPages}</p>
          </div>

          <div className="overflow-hidden rounded-2xl border-2 border-white/20 bg-[#07100c] shadow-[0_18px_50px_rgba(0,0,0,0.3)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
                <thead className="bg-[#0d1712] text-xs uppercase tracking-[0.08em] text-emerald-300">
                  <tr>
                    <th className="border-b border-white/15 px-4 py-4">Date & Time</th>
                    <th className="border-b border-white/15 px-4 py-4">Customer</th>
                    <th className="border-b border-white/15 px-4 py-4">Receptionist</th>
                    <th className="border-b border-white/15 px-4 py-4">Category</th>
                    <th className="border-b border-white/15 px-4 py-4">Subcategory</th>
                    <th className="border-b border-white/15 px-4 py-4">Product</th>
                    <th className="border-b border-white/15 px-4 py-4 text-center">Qty</th>
                    <th className="border-b border-white/15 px-4 py-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.rows.length === 0 ? (
                    <tr><td colSpan={8} className="px-5 py-14 text-center text-white/48">No completed sales have been recorded for this store yet.</td></tr>
                  ) : (
                    overview.rows.map((row) => (
                      <tr key={row.id} className="border-b border-white/10 last:border-b-0 hover:bg-white/[0.025]">
                        <td className="whitespace-nowrap px-4 py-4 align-top"><span className="block font-semibold text-white">{formatSaleDate(row.createdAt)}</span><span className="mt-1 block text-white/48">{formatSaleTime(row.createdAt)}</span></td>
                        <td className="px-4 py-4 align-top"><span className="block font-semibold text-white">{row.customerName}</span>{displayPhone(row.customerPhone) ? <span className="mt-1 block font-semibold text-emerald-300">{displayPhone(row.customerPhone)}</span> : null}</td>
                        <td className="px-4 py-4 align-top font-semibold text-white/82">{row.receptionistName}</td>
                        <td className="px-4 py-4 align-top text-white/72">{row.category}</td>
                        <td className="px-4 py-4 align-top text-white/72">{row.subcategory}</td>
                        <td className="px-4 py-4 align-top font-semibold text-white">{row.productName}</td>
                        <td className="px-4 py-4 text-center align-top font-bold text-white/78">{row.quantity}</td>
                        <td className="whitespace-nowrap px-4 py-4 text-right align-top font-black text-emerald-400"><Money value={row.total} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {overview.totalPages > 1 ? (
            <div className="mt-5 flex items-center justify-end gap-2">
              {overview.currentPage > 1 ? (
                <Link href={`/dashboard/manager/sales?page=${overview.currentPage - 1}`} className="inline-flex h-10 items-center gap-1 rounded-lg border-2 border-white/18 px-3 text-sm font-bold text-white/70 transition hover:border-emerald-300/55 hover:text-emerald-200"><ChevronLeft size={16} /> Previous</Link>
              ) : null}
              <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-lg border border-emerald-300/45 bg-emerald-400/12 px-3 text-sm font-black text-emerald-200">{overview.currentPage}</span>
              {overview.currentPage < overview.totalPages ? (
                <Link href={`/dashboard/manager/sales?page=${overview.currentPage + 1}`} className="inline-flex h-10 items-center gap-1 rounded-lg border-2 border-white/18 px-3 text-sm font-bold text-white/70 transition hover:border-emerald-300/55 hover:text-emerald-200">Next <ChevronRight size={16} /></Link>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
