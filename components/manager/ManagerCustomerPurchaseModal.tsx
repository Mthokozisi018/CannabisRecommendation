"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";
import { refreshManagerCustomerPurchaseOverview } from "@/app/dashboard/manager/sales/actions";
import type { CustomerPurchaseOverview, CustomerPurchaseOverviewInput } from "@/lib/manager/customer-purchase-overview";
import type { SalesReportFilters } from "@/lib/manager/sales-overview";

function formatRand(value: number) {
  return `R ${value.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u00a0/g, " ")}`;
}

export function ManagerCustomerPurchaseModal({ filters, onClose }: { filters: SalesReportFilters; onClose: () => void }) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<CustomerPurchaseOverviewInput["sort"]>("purchases_desc");
  const [page, setPage] = useState(1);
  const [overview, setOverview] = useState<CustomerPurchaseOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    searchRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKeyDown); };
  }, [onClose]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchDraft), 300);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  useEffect(() => {
    let active = true;
    refreshManagerCustomerPurchaseOverview({ filters: { ...filters, page: 1 }, search, sort, page })
      .then((result) => {
        if (!active) return;
        if (result.ok) { setOverview(result.overview); setError(""); }
        else setError(result.message);
      })
      .catch(() => { if (active) setError("Customer purchases could not be loaded. Please try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filters, search, sort, page]);

  function changeSort(field: "purchases" | "spent") {
    setLoading(true);
    setPage(1);
    setSort((current) => current === `${field}_desc` ? `${field}_asc` : `${field}_desc`);
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-3 backdrop-blur-[7px] sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section id="manager-customer-purchase-dialog" role="dialog" aria-modal="true" aria-labelledby="manager-customer-purchase-title" className="flex max-h-[88dvh] w-full max-w-[1100px] flex-col overflow-hidden rounded-2xl border-2 border-[#72d943] bg-[#071c14] text-white shadow-[0_28px_90px_rgba(0,0,0,.7)]">
        <header className="flex items-start justify-between gap-4 border-b border-emerald-500/30 px-5 py-5 sm:px-7">
          <div><h2 id="manager-customer-purchase-title" className="text-xl font-black sm:text-2xl">Customer Purchase Overview</h2><p className="mt-1 text-sm text-white/65">Customers with net purchases in the selected sales report</p></div>
          <button type="button" onClick={onClose} aria-label="Close customer purchase overview" className="grid size-10 shrink-0 place-items-center rounded-lg border border-emerald-400/40 bg-emerald-950 text-white transition hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9ee57d]"><X size={21} /></button>
        </header>
        <div className="min-h-0 overflow-y-auto px-5 pb-5 pt-5 sm:px-7">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <label className="relative block w-full max-w-sm"><span className="sr-only">Search customers by name, surname, or phone number</span><Search size={18} className="pointer-events-none absolute left-3 top-3.5 text-emerald-300" /><input ref={searchRef} type="search" value={searchDraft} onChange={(event) => { setSearchDraft(event.target.value); setLoading(true); setPage(1); }} placeholder="Search name, surname or phone" className="h-11 w-full rounded-xl border border-emerald-400/50 bg-[#08281c] pl-10 pr-3 text-sm text-white placeholder:text-white/50 focus:outline focus:outline-2 focus:outline-[#9ee57d]" /></label>
            <p className="text-sm font-bold text-emerald-200">{overview ? `${overview.matchingCustomers.toLocaleString("en-ZA")} of ${overview.totalCustomers.toLocaleString("en-ZA")} customers` : "Loading customers…"}</p>
          </div>
          {error && <p role="alert" className="mb-4 rounded-lg border border-red-400 bg-red-950 p-3 text-sm text-red-100">{error}</p>}
          <p className="mb-2 text-xs text-emerald-200 sm:hidden">Swipe the table to see purchase counts and totals</p>
          <div className="overflow-x-auto rounded-xl border border-emerald-500/30">
            <table className="w-full min-w-[690px] border-collapse text-left text-sm">
              <thead className="bg-[#0d3b28] text-emerald-100"><tr><th scope="col" className="px-4 py-4">Name</th><th scope="col" className="px-4 py-4">Surname</th><th scope="col" className="px-4 py-4">Phone Number</th><th scope="col" aria-sort={sort.startsWith("purchases") ? (sort.endsWith("desc") ? "descending" : "ascending") : "none"} className="px-4 py-4 text-right"><button type="button" onClick={() => changeSort("purchases")} className="font-bold hover:text-white">Times Purchased</button></th><th scope="col" aria-sort={sort.startsWith("spent") ? (sort.endsWith("desc") ? "descending" : "ascending") : "none"} className="px-4 py-4 text-right"><button type="button" onClick={() => changeSort("spent")} className="font-bold hover:text-white">Total Spent</button></th></tr></thead>
              <tbody className="divide-y divide-emerald-500/20 bg-[#0a241a]">{overview?.rows.map((row) => <tr key={row.customerId} className="hover:bg-emerald-900/30"><td className="px-4 py-3 font-bold">{row.name}</td><td className="px-4 py-3">{row.surname}</td><td className="whitespace-nowrap px-4 py-3">{row.phoneNumber}</td><td className="px-4 py-3 text-right tabular-nums">{row.timesPurchased.toLocaleString("en-ZA")}</td><td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums text-emerald-200">{formatRand(row.totalSpent)}</td></tr>)}
                {!loading && !error && !overview?.rows.length && <tr><td colSpan={5} className="px-4 py-12 text-center text-white/65">No customers match these filters.</td></tr>}
                {loading && !overview && <tr><td colSpan={5} role="status" className="px-4 py-12 text-center text-white/65">Loading customer purchases…</td></tr>}
              </tbody>
            </table>
          </div>
          <nav aria-label="Customer pages" className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-white/65">Page {overview?.page ?? 1} of {overview?.totalPages ?? 1} · 20 customers per page</p><div className="flex gap-2"><button type="button" disabled={loading || !overview || overview.page <= 1} onClick={() => { setLoading(true); setPage((value) => value - 1); }} className="inline-flex min-h-10 items-center rounded-lg border border-emerald-400/40 px-3 text-sm font-bold disabled:opacity-40">Previous</button><button type="button" disabled={loading || !overview || overview.page >= overview.totalPages} onClick={() => { setLoading(true); setPage((value) => value + 1); }} className="inline-flex min-h-10 items-center rounded-lg border border-emerald-400/40 px-3 text-sm font-bold disabled:opacity-40">Next</button></div></nav>
        </div>
      </section>
    </div>, document.body
  );
}
