"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Package, Plus, Search } from "lucide-react";
import { refreshManagerSupplyReport } from "@/app/dashboard/manager/suppliers/actions";
import { groupedTableStyles } from "@/components/manager/grouped-table-styles";
import { PRODUCT_CATEGORIES } from "@/lib/manager/options";
import { supplierCategoryLabel } from "@/lib/manager/supplier-options";
import { supplyPeriodLabel } from "@/lib/manager/supply-history";
import type { SupplyFilters, SupplyReport, SupplyLine } from "@/lib/manager/supply-report";
import styles from "./SupplyHistoryOverview.module.css";

const grid = "lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.15fr)_150px_56px]";
const cells = "[&>span]:min-w-0 [&>span]:break-words lg:gap-0 lg:items-stretch [&>span]:lg:flex [&>span]:lg:flex-col [&>span]:lg:justify-center [&>span]:lg:px-4 [&>span]:lg:py-3 [&>span:last-child]:lg:px-0 [&>span+span]:lg:border-l-2 [&>span+span]:lg:border-[#405347]";
const tones: Record<string, string> = { Flower: "bg-[#145f2b]", "Pre-Rolls": "bg-[#504029]", Edibles: "bg-[#774516]", "Vape Cartridges": "bg-[#52306c]", "Disposable Vapes": "bg-[#52306c]", Concentrates: "bg-[#683841]", Accessories: "bg-[#075780]", Beverages: "bg-[#226158]" };
function money(value: number) { return `R ${value.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u00a0/g, " ")}`; }
function quantities(items: SupplyLine[]) {
  const totals = new Map<string, number>();
  items.forEach(item => totals.set(item.unit, (totals.get(item.unit) ?? 0) + Number(item.quantity)));
  return [...totals].map(([unit, quantity]) => `${quantity.toLocaleString("en-ZA")} ${unit}`).join(" · ");
}
function Badge({ category }: { category: string }) { return <span className={`inline-flex rounded px-2 py-1 text-xs font-bold text-white ${tones[category] ?? "bg-[#34483a]"}`}>{supplierCategoryLabel(category)}</span>; }

export function SupplyHistoryOverview({ initialReport, onRegister, onViewSupplier }: { initialReport: SupplyReport; onRegister: () => void; onViewSupplier: (id: string) => void }) {
  const [report, setReport] = useState(initialReport);
  const [filters, setFilters] = useState(initialReport.filters);
  const [search, setSearch] = useState(initialReport.filters.search);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const sequence = useRef(0);
  const currentFilters = useRef(filters);
  const seedReport = useRef(initialReport);
  const load = useCallback((next: SupplyFilters) => {
    const request = ++sequence.current;
    currentFilters.current = next; setFilters(next); setError(""); setExpandedId(null);
    startTransition(async () => {
      try {
        const result = await refreshManagerSupplyReport(next);
        if (sequence.current !== request) return;
        if (!result.ok) { setError(result.message); return; }
        setReport(result.report); setFilters(result.report.filters); currentFilters.current = result.report.filters;
      } catch { if (sequence.current === request) setError("Supply history could not be loaded. Please retry."); }
    });
  }, [startTransition]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (search !== currentFilters.current.search) load({ ...currentFilters.current, search, page: 1 });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search, load]);
  useEffect(() => {
    if (seedReport.current === initialReport) return;
    seedReport.current = initialReport;
    load(currentFilters.current);
  }, [initialReport, load]);
  const change = (patch: Partial<SupplyFilters>) => load({ ...currentFilters.current, ...patch, search, page: 1 });
  const emptyMessage = report.emptyReason === "month" ? `No supplies recorded for ${supplyPeriodLabel(report.filters.month)}.` : report.emptyReason === "week" ? "No supplies recorded during the selected week." : "No matching supplies found.";
  return <div className="mx-auto max-w-[1280px]">
    <div aria-label="Filtered supply summary" aria-busy={pending} className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[["Supply Transactions", report.summary.transactions, "Unique recorded transactions", "bg-[#0f6333]"], ["Suppliers", report.summary.suppliers, "Unique suppliers in these transactions", "bg-[#0d4d68]"], ["Products Received", report.summary.uniqueProducts.toLocaleString("en-ZA"), "Total unique products received.", "bg-[#6b4b0e]"], ["Total Supply Cost", money(report.summary.totalCost), "Full acquisition cost of matching transactions", "bg-[#4a2a68]"]].map(([label, value, caption, fill]) => <article key={label} className={`rounded-xl border-2 border-[#72d943] ${fill} p-4`}><h3 className="text-sm font-bold">{label}</h3><p className="my-2 break-words text-2xl font-black text-[#b8f09f]">{pending || error ? "—" : value}</p><p className="text-xs text-white">{caption}</p></article>)}
    </div>
    <div className="mt-5 flex flex-wrap items-end gap-3">
      <button type="button" onClick={onRegister} className="inline-flex h-12 items-center gap-2 rounded-xl border-2 border-[#72d943] bg-[#18351e] px-4 text-sm font-black text-[#b8f09f]"><Plus size={18} />Register supplier</button>
      <label className="min-w-[200px] flex-1 text-xs font-black uppercase tracking-wider text-white/70">Supplier profiles<select aria-label="Supplier profile" value={profileId} onChange={event => setProfileId(event.target.value)} className={`${groupedTableStyles.control} mt-2`}><option value="">Select a registered supplier</option>{report.suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}{supplier.status === "inactive" ? " (Inactive)" : ""}</option>)}</select></label>
      <button type="button" disabled={!profileId} onClick={() => onViewSupplier(profileId)} className="h-12 rounded-xl border-2 border-[#405347] bg-[#0a100c] px-4 font-bold disabled:opacity-50">View supplier profile</button>
    </div>
    <section aria-label="Supply history filters" className="mt-6 rounded-2xl border-[3px] border-[#405347] bg-[#080d09] p-4 shadow-2xl sm:p-5">
      <div className={styles.filterGrid}>
        <label className="text-xs font-black uppercase tracking-wider text-white/70">Month<input type="month" aria-label="Supply month" value={filters.month} disabled={pending} onChange={event => { if (event.target.value) change({ month: event.target.value, week: "all" }); }} className={`${groupedTableStyles.control} mt-2 [color-scheme:dark]`} /></label>
        <label className="text-xs font-black uppercase tracking-wider text-white/70">Week<select aria-label="Supply week" value={filters.week} disabled={pending} onChange={event => change({ week: event.target.value })} className={`${groupedTableStyles.control} mt-2`}><option value="all">All month</option>{report.weeks.map((week, index) => <option key={week.value} value={week.value}>Week {index + 1}: {week.label}</option>)}</select></label>
        <label className="text-xs font-black uppercase tracking-wider text-white/70">Recorded By<select aria-label="Recorded by filter" value={filters.recordedBy} disabled={pending} onChange={event => change({ recordedBy: event.target.value })} className={`${groupedTableStyles.control} mt-2`}><option value="all">All managers</option>{report.recorders.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
        <label className="text-xs font-black uppercase tracking-wider text-white/70">Category<select aria-label="Supply category" value={filters.category} disabled={pending} onChange={event => change({ category: event.target.value as SupplyFilters["category"] })} className={`${groupedTableStyles.control} mt-2`}><option value="all">All categories</option>{PRODUCT_CATEGORIES.map(category => <option key={category} value={category}>{supplierCategoryLabel(category)}</option>)}</select></label>
        <label className="text-xs font-black uppercase tracking-wider text-white/70">Supplier<select aria-label="Supply supplier" value={filters.supplier} disabled={pending} onChange={event => change({ supplier: event.target.value })} className={`${groupedTableStyles.control} mt-2`}><option value="all">All suppliers</option>{report.suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
        <label className="text-xs font-black uppercase tracking-wider text-white/70">Search<span className="relative mt-2 block"><Search size={18} className="pointer-events-none absolute left-3 top-3.5 text-[#72d943]" /><input aria-label="Search supplies" value={search} maxLength={100} onChange={event => setSearch(event.target.value)} placeholder="Search supplier, product or reference..." className={`${groupedTableStyles.control} pl-10`} /></span></label>
      </div>
      <p className="mt-4 text-sm font-bold text-[#9ee57d]">{supplyPeriodLabel(filters.month)}</p>
    </section>
    {error && <div role="alert" className="mt-4 rounded-xl border-2 border-red-400 bg-[#2a0d0d] p-4 text-red-100">{error}<button type="button" onClick={() => load(currentFilters.current)} className="ml-3 rounded-lg border-2 px-3 py-2 font-bold">Retry</button></div>}
    <section aria-label="Supply transactions" aria-busy={pending} className={`mt-5 ${groupedTableStyles.frame}`}>
      <div className={groupedTableStyles.heading}><h2 className="text-lg font-black">Supply History</h2><p className="text-sm text-white/60">{report.summary.transactions} {report.summary.transactions === 1 ? "transaction" : "transactions"}</p></div>
      <div className={`${groupedTableStyles.columns} ${grid} ${cells} md:hidden lg:grid lg:px-0 lg:py-0`}><span>Date & Time</span><span>Supplier</span><span>Recorded By</span><span>Category</span><span>Total Supply Cost</span><span className="items-center">Action</span></div>
      {pending ? <p role="status" className="p-8 text-center font-bold">Loading supply transactions…</p> : error ? null : !report.transactions.length ? <div className="grid min-h-48 place-items-center p-6 text-center"><div><Package className="mx-auto text-[#72d943]" size={36} /><h3 className="mt-3 font-bold">{emptyMessage}</h3><p className="mt-2 text-sm text-white/65">{report.emptyReason === "month" ? "Supply transactions will appear here when new stock is recorded." : "Try adjusting your search or filters."}</p></div></div> : report.transactions.map(transaction => {
        const expanded = expandedId === transaction.id;
        const detailsId = `supply-detail-${transaction.id}`;
        return <article key={transaction.id} data-supply-transaction={transaction.id} className={groupedTableStyles.record}>
          <button type="button" aria-label={`${expanded ? "Collapse" : "Expand"} supply ${transaction.reference}`} aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpandedId(expanded ? null : transaction.id)} className={`${groupedTableStyles.row} ${grid} ${cells} lg:px-0 lg:py-0`}>
            <span><span className="block text-xs text-white/60 lg:hidden">Date & Time</span><span className="block font-bold">{transaction.dateTime}</span><span className="block break-all text-xs text-[#9ee57d]">{transaction.reference}</span></span>
            <span><span className="block text-xs text-white/60 lg:hidden">Supplier</span><span className="font-bold">{transaction.supplierName}</span></span>
            <span><span className="block text-xs text-white/60 lg:hidden">Recorded By</span>{transaction.recordedBy}</span>
            <span><span className="block text-xs text-white/60 lg:hidden">Category</span><span className="flex flex-wrap gap-1">{transaction.categories.map(category => <Badge key={category} category={category} />)}</span></span>
            <span><span className="block text-xs text-white/60 lg:hidden">Total Supply Cost</span><span className="font-black text-[#9ee57d]">{money(transaction.totalCost)}</span></span>
            <span className="flex items-center justify-end"><ChevronDown aria-hidden size={20} className={`shrink-0 text-[#72d943] transition-transform ${expanded ? "rotate-180" : ""}`} /></span>
          </button>
          {expanded && <div id={detailsId} className={`${groupedTableStyles.detail} ${styles.detailReveal}`}>
            <div className="overflow-x-auto"><table aria-label={`Products for ${transaction.reference}`} className={groupedTableStyles.itemTable}><thead><tr className={groupedTableStyles.itemHeader}>{["Product", "Category", "Quantity", "Unit Cost", "Total Cost"].map(label => <th key={label} className="border-2 border-[#405347] p-3">{label}</th>)}</tr></thead><tbody>{transaction.items.map(item => <tr key={item.id} className={groupedTableStyles.itemRow}><td className="border-2 border-[#28362d] p-3 font-bold">{item.product_name_snapshot}</td><td className="border-2 border-[#28362d] p-3"><Badge category={item.category_snapshot} /></td><td className="border-2 border-[#28362d] p-3 text-right">{Number(item.quantity).toLocaleString("en-ZA")} {item.unit}</td><td className="border-2 border-[#28362d] p-3 text-right">{money(Number(item.unit_cost))}</td><td className="border-2 border-[#28362d] p-3 text-right">{money(Number(item.line_total))}</td></tr>)}</tbody><tfoot><tr className="bg-[#18351e] font-black"><td colSpan={2} className="border-2 border-[#405347] p-3">Total supply cost</td><td className="border-2 border-[#405347] p-3 text-right">{quantities(transaction.items)}</td><td className="border-2 border-[#405347] p-3 text-right">-</td><td className="border-2 border-[#405347] p-3 text-right">{money(transaction.totalCost)}</td></tr></tfoot></table></div>
            {transaction.needsReconciliation && <p className="mt-3 rounded-lg border border-amber-400 bg-[#352409] p-3 text-sm text-amber-100">Stored costs need reconciliation. Product-line subtotal: {money(transaction.itemSubtotal)}; recorded transaction total: {money(transaction.totalCost)}. Historical values have been preserved.</p>}
            <button type="button" onClick={() => onViewSupplier(transaction.supplierId)} className="mt-4 min-h-11 rounded-lg border-2 border-[#72d943] bg-[#18351e] px-4 font-bold text-[#b8f09f]">View supplier profile</button>
          </div>}
        </article>;
      })}
    </section>
    <nav aria-label="Supply pages" className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-white/60">Page {report.filters.page} of {report.totalPages} · 10 transactions per page</p><div className="flex gap-2"><button type="button" disabled={pending || report.filters.page <= 1} onClick={() => load({ ...currentFilters.current, page: report.filters.page - 1 })} className="inline-flex min-h-11 items-center rounded-xl border-2 border-[#405347] bg-[#0a100c] px-3 font-black disabled:opacity-40"><ChevronLeft size={18} />Previous</button><button type="button" disabled={pending || report.filters.page >= report.totalPages} onClick={() => load({ ...currentFilters.current, page: report.filters.page + 1 })} className="inline-flex min-h-11 items-center rounded-xl border-2 border-[#405347] bg-[#0a100c] px-3 font-black disabled:opacity-40">Next<ChevronRight size={18} /></button></div></nav>
  </div>;
}
