"use client";
import { TransactionDetailsButton } from "@/components/receptionist/pos/TransactionWorkspace";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, Banknote, BarChart3, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Download, List, Search, ShoppingBasket, UsersRound } from "lucide-react";
import { refreshManagerSalesReport } from "@/app/dashboard/manager/sales/actions";
import { DashboardBackdrop } from "@/components/DashboardBackdrop";
import { groupedTableStyles } from "@/components/manager/grouped-table-styles";
import type { ManagerSalesReport, SalesReportFilters } from "@/lib/manager/sales-overview";
import { netSaleCents } from "@/lib/sales-money";
import { getProductImage } from "@/lib/product-images";
import { ManagerCustomerPurchaseModal } from "@/components/manager/ManagerCustomerPurchaseModal";

function formatRand(value: number) {
  return `R ${value.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u00a0/g, " ")}`;
}

const transactionGrid = "lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1.6fr)_minmax(0,1fr)_150px_55px_110px_24px]";

const kpiFills = {
  green: "bg-[#0f6333]",
  blue: "bg-[#0d4d68]",
  amber: "bg-[#6b4b0e]",
  purple: "bg-[#4a2a68]",
  teal: "bg-[#135a56]"
} as const;

function Kpi({ label, value, caption, icon, tone, action }: { label: string; value: string; caption: string; icon: React.ReactNode; tone: keyof typeof kpiFills; action?: React.ReactNode }) {
  return (
    <section className={`relative flex h-full min-w-0 flex-col rounded-2xl border-[4px] border-[#72d943] ${kpiFills[tone]} p-5 shadow-[0_18px_45px_rgba(0,0,0,.35)]`}>
      <div className="flex min-h-14 items-center gap-3 text-white"><span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#1c3821] text-[#72d943]">{icon}</span><span className="font-extrabold">{label}</span></div>
      <p className="mt-4 break-words text-[2rem] font-black leading-tight tracking-tight text-[#72d943]">{value}</p><p className="mt-1 text-sm text-white/85">{caption}</p>
      {action && <div className="absolute right-2 top-2">{action}</div>}
    </section>
  );
}

const controlClass = groupedTableStyles.control;

export function ManagerSalesOverviewUI({ initialReport }: { initialReport: ManagerSalesReport; storeName?: string; managerName?: string }) {
  const [report, setReport] = useState(initialReport);
  const [filters, setFilters] = useState<SalesReportFilters>(initialReport.filters);
  const [searchDraft, setSearchDraft] = useState(initialReport.filters.search);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [exportState, setExportState] = useState<"idle" | "working" | "error">("idle");
  const [customersOpen, setCustomersOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const requestId = useRef(0);
  const customersButtonRef = useRef<HTMLButtonElement>(null);
  const closeCustomers = useCallback(() => { setCustomersOpen(false); window.requestAnimationFrame(() => customersButtonRef.current?.focus()); }, []);

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
    <div className="relative isolate min-h-screen overflow-x-hidden bg-[#071008] text-white">
      <DashboardBackdrop variant="receptionist" image="/images/backgrounds/registration-sales-wallpaper.png" />
      <div className="relative z-10">
        <main aria-label="Manager Sales Overview" className="mx-auto max-w-[1360px] px-4 pb-4 pt-1 sm:px-8">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 lg:grid lg:grid-cols-[max-content_minmax(0,1fr)_max-content] lg:gap-x-4">
            <Link href="/dashboard/manager" className="order-1 inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-[#72d943] px-4 py-2 text-sm font-extrabold text-[#9ee57d] transition hover:border-[#9ee57d] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9ee57d]"><ArrowLeft size={18} /> Back to manager dashboard</Link>
            <button type="button" onClick={exportPdf} disabled={isPending || exportState === "working"} className="order-2 inline-flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-[#72d943] lg:order-3 bg-[#72d943] px-5 font-black text-[#071007] shadow-lg disabled:cursor-wait disabled:opacity-65"><Download size={18} />{exportState === "working" ? "Preparing PDF…" : "Export filtered PDF"}</button>
            <h1 className="order-3 mx-auto w-full max-w-[650px] leading-none lg:order-2" aria-label="Sales Overview">
              <svg className="block h-auto w-full" viewBox="40 170 2090 410" aria-hidden="true" focusable="false">
                <image href="/images/manager/sales-overview-heading.png" width="2170" height="725" />
              </svg>
            </h1>
          </div>
          {exportState === "error" && <p role="alert" className="mt-3 rounded-xl border-2 border-red-400 bg-[#2a0d0d] p-3 text-sm font-bold text-red-100">The PDF could not be exported. Please try again.</p>}

          <section aria-label="Sales KPIs" className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <Kpi label="Revenue This Week" value={formatRand(report.kpis.revenueThisWeek)} caption={report.kpis.currentWeekLabel} icon={<Banknote size={22} />} tone="green" />
            <Kpi label="Revenue This Month" value={formatRand(report.kpis.revenueThisMonth)} caption={report.kpis.currentMonthLabel} icon={<CalendarDays size={22} />} tone="blue" />
            <Kpi label="Revenue This Year" value={formatRand(report.kpis.revenueThisYear)} caption={report.kpis.currentYearLabel} icon={<CalendarDays size={22} />} tone="teal" />
            <Kpi label="Total Customers" value={report.summary.uniqueCustomers.toLocaleString("en-ZA")} caption="Identifiable customers in the selected report" icon={<UsersRound size={22} />} tone="amber" action={<button ref={customersButtonRef} type="button" title="View Customers" aria-label="View Customers" aria-haspopup="dialog" aria-controls="manager-customer-purchase-dialog" disabled={isPending} onClick={() => setCustomersOpen(true)} className="grid size-8 place-items-center rounded-lg border border-amber-200/70 bg-[#8a651b] text-amber-50 shadow-sm transition hover:bg-[#a87d2a] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50"><List size={17} /></button>} />
            <Kpi label="Total Transactions" value={report.summary.transactionCount.toLocaleString("en-ZA")} caption="Completed checkouts in the selected report" icon={<BarChart3 size={22} />} tone="purple" />
          </section>

          <section aria-label="Sales report controls" className="mt-4 rounded-2xl border-[3px] border-[#405347] bg-[#080d09] p-4 shadow-2xl sm:p-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <label className="text-xs font-black uppercase tracking-wider text-white/70">Month<input aria-label="Report month" type="month" value={filters.month} disabled={isPending} onChange={(event) => { const next = { ...filters, month: event.target.value, week: "all" as const, receptionist: "all", category: "all", page: 1 }; setSearchDraft(""); load({ ...next, search: "" }); }} className={`${controlClass} mt-2 [color-scheme:dark]`} /></label>
              <label className="text-xs font-black uppercase tracking-wider text-white/70">Week<select aria-label="Report week" value={filters.week} disabled={isPending} onChange={(event) => load({ ...filters, week: event.target.value, page: 1 })} className={`${controlClass} mt-2`}><option value="all">All month</option>{report.weeks.map((week) => <option key={week.value} value={week.value}>{week.label}</option>)}</select></label>
              <label className="text-xs font-black uppercase tracking-wider text-white/70">Receptionist<select aria-label="Receptionist filter" value={filters.receptionist} disabled={isPending} onChange={(event) => load({ ...filters, receptionist: event.target.value, page: 1 })} className={`${controlClass} mt-2`}><option value="all">All receptionists</option>{report.receptionistOptions.map((name) => <option key={name}>{name}</option>)}</select></label>
              <label className="text-xs font-black uppercase tracking-wider text-white/70">Category<select aria-label="Category filter" value={filters.category} disabled={isPending} onChange={(event) => load({ ...filters, category: event.target.value, page: 1 })} className={`${controlClass} mt-2`}><option value="all">All categories</option>{report.categoryOptions.map((name) => <option key={name}>{name}</option>)}</select></label>
              <label className="text-xs font-black uppercase tracking-wider text-white/70">Search<span className="relative mt-2 block"><Search className="pointer-events-none absolute left-3 top-3.5 text-[#72d943]" size={18} /><input aria-label="Search transactions" value={searchDraft} disabled={isPending} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Receipt, customer, product…" className={`${controlClass} pl-10`} /></span></label>
            </div>
            <div className="mt-4 flex min-h-6 flex-wrap items-center justify-between gap-2 text-sm"><p className="font-bold text-[#9ee57d]">{report.periodLabel}</p>{isPending && <p role="status" className="animate-pulse font-bold text-white/70">Refreshing report…</p>}</div>
          </section>

          {loadError && <div role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-red-400 bg-[#2a0d0d] p-4 text-red-100"><p className="font-bold">{loadError}</p><button type="button" onClick={() => load(filters)} className="rounded-lg border-2 border-red-200 px-3 py-1.5 font-black">Try again</button></div>}

          <section className={`mt-6 ${groupedTableStyles.frame}`} aria-busy={isPending}>
            <div className={groupedTableStyles.heading}><h2 className="text-lg font-black">Grouped transactions</h2><p className="text-sm text-white/60">{report.totalTransactions.toLocaleString("en-ZA")} result{report.totalTransactions === 1 ? "" : "s"}</p></div>
            <div className={`${groupedTableStyles.columns} ${transactionGrid} md:hidden lg:grid`}><span>Date & time</span><span>Customer</span><span>Receptionist</span><span className="text-center whitespace-nowrap">Payment method</span><span className="text-center">Items</span><span className="text-right">Total</span><span /></div>
            {!report.transactions.length && <div className="grid min-h-56 place-items-center px-5 py-12 text-center"><div><ShoppingBasket className="mx-auto text-[#72d943]" size={38} /><h3 className="mt-4 text-xl font-black">Nothing to show</h3><p className="mt-2 text-white/65">{emptyMessage}</p>{report.emptyReason === "no-search-results" && <button type="button" onClick={() => { setSearchDraft(""); load({ ...filters, search: "", receptionist: "all", category: "all", page: 1 }); }} className="mt-5 rounded-xl border-2 border-[#72d943] bg-[#18351e] px-4 py-2 font-black text-[#b8f09f]">Clear search and filters</button>}</div></div>}
            {report.transactions.map((transaction) => {
              const expanded = expandedId === transaction.saleId;
              const detailsId = `sale-details-${transaction.saleId}`;
              return <article key={transaction.saleId} className={groupedTableStyles.record}>
                <button type="button" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpandedId(expanded ? null : transaction.saleId)} className={`${groupedTableStyles.row} ${transactionGrid} lg:items-center [&>span]:min-w-0`}>
                  <span><span className="block text-xs font-black uppercase text-white/45 lg:hidden">Date & time</span><span className="font-bold">{transaction.date}</span><span className="ml-2 text-sm text-white/55">{transaction.time}</span><span title={transaction.receiptReference} className="block truncate text-xs text-[#9ee57d]">{transaction.receiptReference}</span></span>
                  <span><span className="block text-xs font-black uppercase text-white/45 lg:hidden">Customer</span><span className="block font-bold">{transaction.customerName}</span><span className="block text-sm text-white/55">{transaction.customerPhone}</span></span>
                  <span><span className="block text-xs font-black uppercase text-white/45 lg:hidden">Receptionist</span><span className="font-bold">{transaction.receptionistName}</span></span>
                  <span className="lg:text-center"><span className="block text-xs font-black uppercase text-white/45 lg:hidden">Payment method</span><span className="font-bold">{transaction.paymentMethod ? transaction.paymentMethod.charAt(0).toUpperCase() + transaction.paymentMethod.slice(1) : "Not recorded"}</span></span>
                  <span className="lg:text-center"><span className="mr-2 text-xs font-black uppercase text-white/45 lg:hidden">Items</span><span className="font-black">{transaction.itemCount.toLocaleString("en-ZA")}</span></span>
                  <span className="flex flex-wrap items-center gap-1.5 lg:justify-end"><span className="text-xs font-black uppercase text-white/45 lg:hidden">Total</span><span className="whitespace-nowrap font-black text-[#72d943]">{formatRand(transaction.recordedTotal)}</span>{transaction.refundedAmount > 0 && netSaleCents({ total: transaction.recordedTotal, refunded_amount: transaction.refundedAmount }) <= 0 && <span className="rounded-md bg-red-900 px-2 py-0.5 text-xs font-bold text-red-100">Refunded</span>}</span>
                  <ChevronDown className={`text-[#72d943] transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>
                {expanded && <div id={detailsId} className={groupedTableStyles.detail}>
                  <TransactionDetailsButton saleId={transaction.saleId} onUpdated={() => load(filters)} />
                  {transaction.refundedAmount > 0 && <p className="text-red-300">Refunded {formatRand(transaction.refundedAmount)} | Net revenue {formatRand(transaction.recordedTotal - transaction.refundedAmount)}</p>}
                  {transaction.needsReconciliation && <p className="mb-4 rounded-lg border-2 border-amber-500 bg-[#2a1d08] p-3 text-sm font-bold text-amber-100">The recorded sale total differs from the item subtotal. The recorded total remains authoritative.</p>}
                  <div className="overflow-x-auto"><table className={groupedTableStyles.itemTable}><thead><tr className={groupedTableStyles.itemHeader}><th className="border-y-2 border-l-2 border-[#405347] p-3">Product</th><th className="border-y-2 border-[#405347] p-3">Category</th><th className="border-y-2 border-[#405347] p-3">Subcategory</th><th className="border-y-2 border-[#405347] p-3 text-right">Quantity</th><th className="border-y-2 border-[#405347] p-3 text-right">Unit price</th><th className="border-y-2 border-r-2 border-[#405347] p-3 text-right">Subtotal</th></tr></thead><tbody>{transaction.items.length ? transaction.items.map((item, index) => <tr key={`${item.product}-${index}`} className={groupedTableStyles.itemRow}><td className="border-b-2 border-l-2 border-[#28362d] p-3 font-bold"><div className="flex items-center gap-3"><span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg border border-[#405347] bg-[#14251a]"><Image src={getProductImage({ category: item.category, subcategory: item.subcategory, cultivationType: item.cultivationType })} alt="" width={44} height={44} className="h-full w-full object-cover" /></span><span>{item.product}</span></div></td><td className="border-b-2 border-[#28362d] p-3">{item.category}</td><td className="border-b-2 border-[#28362d] p-3"><div className="flex min-w-[180px] items-center justify-between gap-3"><span>{item.subcategory}</span>{item.category.trim().toLowerCase() === "flower" && <span className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${item.cultivationType ? "border-[#72d943]/70 bg-[#173d26] text-[#b8f09f]" : "border-[#66736a] bg-[#1d2920] text-[#b6c1b8]"}`}>{item.cultivationType ?? "Not recorded"}</span>}</div></td><td className="border-b-2 border-[#28362d] p-3 text-right">{item.quantity}</td><td className="border-b-2 border-[#28362d] p-3 text-right">{formatRand(item.unitPrice)}</td><td className="border-b-2 border-r-2 border-[#28362d] p-3 text-right font-black text-[#9ee57d]">{formatRand(item.subtotal)}</td></tr>) : <tr><td colSpan={6} className="border-2 border-t-0 border-[#28362d] bg-[#090e0a] p-4 text-center text-white/60">Item details are unavailable for this historical sale.</td></tr>}</tbody></table></div>
                  <div className="mt-4 flex justify-end gap-6 text-sm"><span className="text-white/60">Item subtotal <strong className="ml-2 text-white">{formatRand(transaction.itemSubtotal)}</strong></span><span className="text-white/60">Recorded total <strong className="ml-2 text-[#72d943]">{formatRand(transaction.recordedTotal)}</strong></span></div>
                </div>}
              </article>;
            })}
          </section>
          <nav aria-label="Sales pages" className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-white/60">Page {filters.page} of {report.totalPages} · 10 grouped transactions per page</p><div className="flex gap-2"><button type="button" disabled={isPending || filters.page <= 1} onClick={() => load({ ...filters, page: filters.page - 1 })} className="inline-flex h-11 items-center gap-1 rounded-xl border-2 border-[#405347] bg-[#0a100c] px-3 font-black disabled:opacity-40"><ChevronLeft size={18} /> Previous</button><button type="button" disabled={isPending || filters.page >= report.totalPages} onClick={() => load({ ...filters, page: filters.page + 1 })} className="inline-flex h-11 items-center gap-1 rounded-xl border-2 border-[#405347] bg-[#0a100c] px-3 font-black disabled:opacity-40">Next <ChevronRight size={18} /></button></div></nav>
          {customersOpen && <ManagerCustomerPurchaseModal key={JSON.stringify(report.filters)} filters={report.filters} onClose={closeCustomers} />}
        </main>
      </div>
    </div>
  );
}
