"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, Banknote, BarChart3, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Download, Leaf, Search, ShoppingBasket, UsersRound } from "lucide-react";
import { refreshManagerSalesReport } from "@/app/dashboard/manager/sales/actions";
import { DashboardBackdrop } from "@/components/GreenChoiceDashboard";
import type { ManagerSalesReport, SalesReportFilters } from "@/lib/manager/sales-overview";

function formatRand(value: number) {
  return `R ${value.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u00a0/g, " ")}`;
}

function TopBar({ storeName, managerName }: { storeName: string; managerName: string }) {
  const initials = managerName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "M";
  return (
    <header className="sticky top-0 z-30 border-b-2 border-[#243128] bg-[#070b08] px-4 py-3 shadow-xl sm:px-8">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#72d943] text-[#071007]"><Leaf size={21} fill="currentColor" /></span>
          <div className="min-w-0"><p className="font-black text-white">GreenChoice</p><p className="truncate text-xs font-bold text-[#72d943]">{storeName}</p></div>
        </div>
        <div className="flex items-center gap-2"><span className="grid size-10 place-items-center rounded-full bg-[#72d943] text-sm font-black text-[#071007]">{initials}</span><span className="hidden text-sm font-bold text-white sm:block">{managerName}</span></div>
      </div>
    </header>
  );
}

function Kpi({ label, value, caption, icon }: { label: string; value: string; caption: string; icon: React.ReactNode }) {
  return (
    <section className="rounded-2xl border-[3px] border-[#72d943] bg-[#090d0a] p-5 shadow-[0_18px_45px_rgba(0,0,0,.35)]">
      <div className="flex items-center gap-3 text-white"><span className="grid size-11 place-items-center rounded-full bg-[#1c3821] text-[#72d943]">{icon}</span><span className="font-extrabold">{label}</span></div>
      <p className="mt-4 text-3xl font-black text-[#72d943]">{value}</p><p className="mt-1 text-sm text-white/60">{caption}</p>
    </section>
  );
}

const controlClass = "h-12 w-full rounded-xl border-2 border-[#405347] bg-[#0a100c] px-3 text-sm font-bold text-white outline-none transition focus:border-[#72d943] focus:ring-2 focus:ring-[#72d943]/25 disabled:opacity-60";

export function ManagerSalesOverviewUI({ initialReport, storeName, managerName }: { initialReport: ManagerSalesReport; storeName: string; managerName: string }) {
  const [report, setReport] = useState(initialReport);
  const [filters, setFilters] = useState<SalesReportFilters>(initialReport.filters);
  const [searchDraft, setSearchDraft] = useState(initialReport.filters.search);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [exportState, setExportState] = useState<"idle" | "working" | "error">("idle");
  const [isPending, startTransition] = useTransition();
  const requestId = useRef(0);

  function load(next: SalesReportFilters) {
    const id = ++requestId.current;
    setFilters(next);
    setLoadError("");
    startTransition(async () => {
      const result = await refreshManagerSalesReport(next);
      if (id !== requestId.current) return;
      if (!result.ok) { setLoadError(result.message); return; }
      setReport(result.report);
      setFilters(result.report.filters);
      setExpandedId((current) => result.report.transactions.some((transaction) => transaction.saleId === current) ? current : null);
    });
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchDraft !== filters.search) load({ ...filters, search: searchDraft, page: 1 });
    }, 350);
    return () => window.clearTimeout(timer);
    // Only the search draft should restart the debounce timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

  async function exportPdf() {
    setExportState("working");
    try {
      const response = await fetch("/api/dashboard/manager/sales/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(filters) });
      if (!response.ok) throw new Error("export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `greenchoice-sales-${filters.month}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      setExportState("idle");
    } catch { setExportState("error"); }
  }

  const emptyMessage = report.emptyReason === "no-month-sales"
    ? "There are no completed sales in this month."
    : report.emptyReason === "no-week-sales"
      ? "There are no completed sales in this week."
      : "No transactions match your search and filters.";

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#071008] text-white">
      <DashboardBackdrop />
      <div className="relative z-10"><TopBar storeName={storeName} managerName={managerName} />
        <main className="mx-auto max-w-[1280px] px-4 py-7 sm:px-8 sm:py-10">
          <Link href="/dashboard/manager" className="inline-flex items-center gap-2 text-sm font-extrabold text-[#9ee57d] hover:text-white"><ArrowLeft size={18} /> Back to manager dashboard</Link>
          <div className="mt-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div><p className="text-xs font-black uppercase tracking-[.24em] text-[#72d943]">Reporting</p><h1 className="mt-2 text-3xl font-black sm:text-5xl">Sales Overview</h1><p className="mt-2 max-w-2xl text-white/65">Review each completed checkout as one transaction, with its products and totals kept together.</p></div>
            <button type="button" onClick={exportPdf} disabled={isPending || exportState === "working"} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-[#72d943] bg-[#72d943] px-5 font-black text-[#071007] shadow-lg disabled:cursor-wait disabled:opacity-65"><Download size={18} />{exportState === "working" ? "Preparing PDF..." : "Export filtered PDF"}</button>
          </div>
          {exportState === "error" && <p role="alert" className="mt-3 rounded-xl border-2 border-red-400 bg-[#2a0d0d] p-3 text-sm font-bold text-red-100">The PDF could not be exported. Please try again.</p>}

          <section aria-label="Sales report controls" className="mt-8 rounded-2xl border-[3px] border-[#405347] bg-[#080d09] p-4 shadow-2xl sm:p-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <label className="text-xs font-black uppercase tracking-wider text-white/70">Month<input aria-label="Report month" type="month" value={filters.month} disabled={isPending} onChange={(event) => { const next = { ...filters, month: event.target.value, week: "all" as const, receptionist: "all", category: "all", page: 1 }; setSearchDraft(""); load({ ...next, search: "" }); }} className={`${controlClass} mt-2 [color-scheme:dark]`} /></label>
              <label className="text-xs font-black uppercase tracking-wider text-white/70">Week<select aria-label="Report week" value={filters.week} disabled={isPending} onChange={(event) => load({ ...filters, week: event.target.value, page: 1 })} className={`${controlClass} mt-2`}><option value="all">All month</option>{report.weeks.map((week) => <option key={week.value} value={week.value}>{week.label}</option>)}</select></label>
              <label className="text-xs font-black uppercase tracking-wider text-white/70">Receptionist<select aria-label="Receptionist filter" value={filters.receptionist} disabled={isPending} onChange={(event) => load({ ...filters, receptionist: event.target.value, page: 1 })} className={`${controlClass} mt-2`}><option value="all">All receptionists</option>{report.receptionistOptions.map((name) => <option key={name}>{name}</option>)}</select></label>
              <label className="text-xs font-black uppercase tracking-wider text-white/70">Category<select aria-label="Category filter" value={filters.category} disabled={isPending} onChange={(event) => load({ ...filters, category: event.target.value, page: 1 })} className={`${controlClass} mt-2`}><option value="all">All categories</option>{report.categoryOptions.map((name) => <option key={name}>{name}</option>)}</select></label>
              <label className="text-xs font-black uppercase tracking-wider text-white/70">Search<span className="relative mt-2 block"><Search className="pointer-events-none absolute left-3 top-3.5 text-[#72d943]" size={18} /><input aria-label="Search transactions" value={searchDraft} disabled={isPending} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Receipt, customer, product..." className={`${controlClass} pl-10`} /></span></label>
            </div>
            <div className="mt-4 flex min-h-6 flex-wrap items-center justify-between gap-2 text-sm"><p className="font-bold text-[#9ee57d]">{report.periodLabel}</p>{isPending && <p role="status" className="animate-pulse font-bold text-white/70">Refreshing report...</p>}</div>
          </section>

          {loadError && <div role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-red-400 bg-[#2a0d0d] p-4 text-red-100"><p className="font-bold">{loadError}</p><button type="button" onClick={() => load(filters)} className="rounded-lg border-2 border-red-200 px-3 py-1.5 font-black">Try again</button></div>}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Revenue This Week" value={formatRand(report.kpis.revenueThisWeek)} caption={report.kpis.currentWeekLabel} icon={<Banknote size={22} />} />
            <Kpi label="Revenue This Month" value={formatRand(report.kpis.revenueThisMonth)} caption={report.kpis.currentMonthLabel} icon={<CalendarDays size={22} />} />
            <Kpi label="Total Customers" value={report.summary.uniqueCustomers.toLocaleString("en-ZA")} caption="Identifiable customers in the selected report" icon={<UsersRound size={22} />} />
            <Kpi label="Total Transactions" value={report.summary.transactionCount.toLocaleString("en-ZA")} caption="Completed checkouts in the selected report" icon={<BarChart3 size={22} />} />
          </div>

          <section className="mt-6 overflow-hidden rounded-2xl border-[3px] border-[#405347] bg-[#080d09] shadow-2xl" aria-busy={isPending}>
            <div className="border-b-[3px] border-[#405347] bg-[#101a12] px-4 py-4 sm:px-5"><h2 className="text-lg font-black">Grouped transactions</h2><p className="text-sm text-white/60">{report.totalTransactions.toLocaleString("en-ZA")} result{report.totalTransactions === 1 ? "" : "s"}</p></div>
            <div className="hidden grid-cols-[1.1fr_1.5fr_1.2fr_.55fr_.8fr_40px] gap-3 border-b-2 border-[#405347] bg-[#18351e] px-5 py-3 text-xs font-black uppercase tracking-wider text-[#b8f09f] md:grid"><span>Date & time</span><span>Customer</span><span>Receptionist</span><span>Items</span><span className="text-right">Total</span><span /></div>
            {!report.transactions.length && <div className="grid min-h-56 place-items-center px-5 py-12 text-center"><div><ShoppingBasket className="mx-auto text-[#72d943]" size={38} /><h3 className="mt-4 text-xl font-black">Nothing to show</h3><p className="mt-2 text-white/65">{emptyMessage}</p>{report.emptyReason === "no-search-results" && <button type="button" onClick={() => { setSearchDraft(""); load({ ...filters, search: "", receptionist: "all", category: "all", page: 1 }); }} className="mt-5 rounded-xl border-2 border-[#72d943] bg-[#18351e] px-4 py-2 font-black text-[#b8f09f]">Clear search and filters</button>}</div></div>}
            {report.transactions.map((transaction) => {
              const expanded = expandedId === transaction.saleId;
              const detailsId = `sale-details-${transaction.saleId}`;
              return <article key={transaction.saleId} className="border-b-2 border-[#28362d] last:border-b-0">
                <button type="button" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpandedId(expanded ? null : transaction.saleId)} className="grid w-full gap-3 bg-[#0a100c] px-4 py-4 text-left transition hover:bg-[#122017] focus:bg-[#122017] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#72d943] md:grid-cols-[1.1fr_1.5fr_1.2fr_.55fr_.8fr_40px] md:items-center md:px-5">
                  <span><span className="block text-xs font-black uppercase text-white/45 md:hidden">Date & time</span><span className="font-bold">{transaction.date}</span><span className="ml-2 text-sm text-white/55">{transaction.time}</span><span className="block text-xs text-[#9ee57d]">{transaction.receiptReference}</span></span>
                  <span><span className="block text-xs font-black uppercase text-white/45 md:hidden">Customer</span><span className="block font-bold">{transaction.customerName}</span><span className="block text-sm text-white/55">{transaction.customerPhone}</span></span>
                  <span><span className="block text-xs font-black uppercase text-white/45 md:hidden">Receptionist</span><span className="font-bold">{transaction.receptionistName}</span></span>
                  <span><span className="mr-2 text-xs font-black uppercase text-white/45 md:hidden">Items</span><span className="font-black">{transaction.itemCount.toLocaleString("en-ZA")}</span></span>
                  <span className="md:text-right"><span className="mr-2 text-xs font-black uppercase text-white/45 md:hidden">Total</span><span className="font-black text-[#72d943]">{formatRand(transaction.recordedTotal)}</span></span>
                  <ChevronDown className={`text-[#72d943] transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>
                {expanded && <div id={detailsId} className="border-t-2 border-[#72d943] bg-[#111a13] px-4 py-4 sm:px-5">
                  {transaction.needsReconciliation && <p className="mb-4 rounded-lg border-2 border-amber-500 bg-[#2a1d08] p-3 text-sm font-bold text-amber-100">The recorded sale total differs from the item subtotal. The recorded total remains authoritative.</p>}
                  <div className="overflow-x-auto"><table className="w-full min-w-[680px] border-separate border-spacing-0 text-sm"><thead><tr className="bg-[#18351e] text-left text-xs uppercase tracking-wider text-[#b8f09f]"><th className="border-y-2 border-l-2 border-[#405347] p-3">Product</th><th className="border-y-2 border-[#405347] p-3">Category</th><th className="border-y-2 border-[#405347] p-3">Subcategory</th><th className="border-y-2 border-[#405347] p-3 text-right">Quantity</th><th className="border-y-2 border-[#405347] p-3 text-right">Unit price</th><th className="border-y-2 border-r-2 border-[#405347] p-3 text-right">Subtotal</th></tr></thead><tbody>{transaction.items.length ? transaction.items.map((item, index) => <tr key={`${item.product}-${index}`} className="bg-[#090e0a]"><td className="border-b-2 border-l-2 border-[#28362d] p-3 font-bold">{item.product}</td><td className="border-b-2 border-[#28362d] p-3">{item.category}</td><td className="border-b-2 border-[#28362d] p-3">{item.subcategory}</td><td className="border-b-2 border-[#28362d] p-3 text-right">{item.quantity}</td><td className="border-b-2 border-[#28362d] p-3 text-right">{formatRand(item.unitPrice)}</td><td className="border-b-2 border-r-2 border-[#28362d] p-3 text-right font-black text-[#9ee57d]">{formatRand(item.subtotal)}</td></tr>) : <tr><td colSpan={6} className="border-2 border-t-0 border-[#28362d] bg-[#090e0a] p-4 text-center text-white/60">Item details are unavailable for this historical sale.</td></tr>}</tbody></table></div>
                  <div className="mt-4 flex justify-end gap-6 text-sm"><span className="text-white/60">Item subtotal <strong className="ml-2 text-white">{formatRand(transaction.itemSubtotal)}</strong></span><span className="text-white/60">Recorded total <strong className="ml-2 text-[#72d943]">{formatRand(transaction.recordedTotal)}</strong></span></div>
                </div>}
              </article>;
            })}
          </section>
          <nav aria-label="Sales pages" className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-white/60">Page {filters.page} of {report.totalPages} - 10 grouped transactions per page</p><div className="flex gap-2"><button type="button" disabled={isPending || filters.page <= 1} onClick={() => load({ ...filters, page: filters.page - 1 })} className="inline-flex h-11 items-center gap-1 rounded-xl border-2 border-[#405347] bg-[#0a100c] px-3 font-black disabled:opacity-40"><ChevronLeft size={18} /> Previous</button><button type="button" disabled={isPending || filters.page >= report.totalPages} onClick={() => load({ ...filters, page: filters.page + 1 })} className="inline-flex h-11 items-center gap-1 rounded-xl border-2 border-[#405347] bg-[#0a100c] px-3 font-black disabled:opacity-40">Next <ChevronRight size={18} /></button></div></nav>
        </main>
      </div>
    </div>
  );
}
