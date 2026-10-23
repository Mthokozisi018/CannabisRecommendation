"use client";

import { Fragment, useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import type { SupplyDistribution, SupplySnapshot } from "@/lib/master-supply/data";
import { distributionTimestamp, filterSupplyHistory, historyDateBounds, type HistoryPeriod } from "@/lib/master-supply/history-filters";
import { location, Notice, number, Pager, ProductLabel, stamp, Status, StoreLabel, useSupplyMutation } from "./shared";
import styles from "./MasterSupply.module.css";

const periods: { value: HistoryPeriod; label: string }[] = [
  { value: "all_time", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "this_year", label: "This Year" },
  { value: "custom", label: "Custom Range" },
];

function DistributionDetails({ distribution, snapshot }: { distribution: SupplyDistribution; snapshot: SupplySnapshot }) {
  const store = snapshot.stores.find(item => item.id === distribution.store_id);
  const products = new Map(snapshot.products.map(product => [product.id, product]));
  const items = distribution.master_supply_distribution_items;
  const mutation = useSupplyMutation();

  return <div id={`distribution-details-${distribution.id}`} className={styles.historyExpanded}>
    <div className={styles.tableWrap}>
      <table className={`${styles.table} ${styles.historyProducts}`} aria-label={`Products in distribution to ${store?.name ?? "store"}`}>
        <thead><tr>{["Product", "Category", "Subcategory", "Cultivation Type", "Strain Type", "Units Distributed", "Unit Cost", "Total Cost"].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{items.map(item => {
          const product = products.get(item.product_id);
          return <tr key={item.product_id}>
            <td><ProductLabel product={product} /></td>
            <td>{product?.category ?? "—"}</td>
            <td>{product?.subcategory || "—"}</td>
            <td>{product?.cultivation_type || "—"}</td>
            <td>{product?.strain_type || "—"}</td>
            <td>{number(item.quantity)}</td>
            <td>—</td><td>—</td>
          </tr>;
        })}</tbody>
      </table>
      {!items.length ? <p className={styles.empty}>No product records are available for this distribution.</p> : null}
    </div>
    {distribution.notes ? <p className={styles.historyNotes}>Notes: {distribution.notes}</p> : null}
    <Notice message={mutation.message} error={mutation.error} />
    {distribution.status === "reserved" ? <div className={styles.inline}>
      <button type="button" className={`${styles.button} ${styles.primary}`} disabled={mutation.busy} onClick={() => void mutation.run("dispatch", { distributionId: distribution.id })}>Mark Dispatched</button>
      <button type="button" className={`${styles.button} ${styles.danger}`} disabled={mutation.busy} onClick={() => void mutation.run("cancel", { distributionId: distribution.id })}>Cancel Distribution</button>
    </div> : null}
    <div className={styles.historyTotals}>
      <span>Total products distributed <strong>{number(items.length)}</strong></span>
      <span>Total units distributed <strong>{number(items.reduce((sum, item) => sum + item.quantity, 0))}</strong></span>
      <span>Total recorded distribution cost <strong>—</strong></span>
    </div>
  </div>;
}

export function SupplyHistory({ snapshot, initialStoreId = "" }: { snapshot: SupplySnapshot; initialStoreId?: string }) {
  const [search, setSearch] = useState("");
  const [storeId, setStoreId] = useState(initialStoreId);
  const [status, setStatus] = useState("");
  const [period, setPeriod] = useState<HistoryPeriod>("all_time");
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dateError, setDateError] = useState("");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const mutation = useSupplyMutation();
  const stores = new Map(snapshot.stores.map(store => [store.id, store]));
  const filters = { search, storeId, status, period, from, to };
  const filtered = filterSupplyHistory(snapshot, filters);
  const visible = filtered.slice(page * 8, page * 8 + 8);

  function changeFilter(update: () => void) { update(); setPage(0); setExpanded(null); }
  function reset() {
    changeFilter(() => { setSearch(""); setStoreId(""); setStatus(""); setPeriod("all_time"); setFrom(""); setTo(""); setDraftFrom(""); setDraftTo(""); setDateError(""); });
  }
  function applyCustomRange(event: React.FormEvent) {
    event.preventDefault();
    try {
      historyDateBounds({ period: "custom", from: draftFrom, to: draftTo });
      if (!draftFrom || !draftTo) throw new Error("Choose both dates.");
      changeFilter(() => { setFrom(draftFrom); setTo(draftTo); setDateError(""); });
    } catch (error) { setDateError(error instanceof Error ? error.message : "Choose valid dates."); }
  }
  async function exportPdf() {
    setExporting(true); setExportError("");
    try {
      const bounds = historyDateBounds(filters);
      const response = await fetch("/api/dashboard/franchise/supply/history/export", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ search, storeId, status, from: bounds?.start ?? "", to: bounds ? (bounds.inclusiveEnd ? bounds.end : new Date(Date.parse(`${bounds.end}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)) : "" })
      });
      if (!response.ok) throw new Error("Distribution history could not be exported.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = "greenchoice-master-supply-history.pdf"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setExportError(error instanceof Error ? error.message : "Export failed."); }
    finally { setExporting(false); }
  }

  return <section className={styles.panel}>
    <Notice message={exportError} error />
    <div className={`${styles.toolbar} ${styles.historyToolbar}`}>
      <input aria-label="Search distributions" placeholder="Search store, product or location…" value={search} onChange={event => changeFilter(() => setSearch(event.target.value))} />
      <select aria-label="Store" value={storeId} onChange={event => changeFilter(() => setStoreId(event.target.value))}><option value="">All Stores</option>{snapshot.stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}</select>
      <select aria-label="Status" value={status} onChange={event => changeFilter(() => setStatus(event.target.value))}><option value="">All Statuses</option>{["reserved", "in_transit", "delivered", "discrepancy", "cancelled"].map(value => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select>
      <button type="button" className={styles.button} onClick={reset}>Clear Filters</button>
      <button type="button" className={styles.button} disabled={exporting} onClick={() => void exportPdf()}>{exporting ? "Exporting…" : "↓ Export to PDF"}</button>
      <label className={`${styles.periodSelect} ${styles.historyPeriod}`}><CalendarDays size={19} aria-hidden="true" /><select aria-label="Date range" value={period} onChange={event => changeFilter(() => { setPeriod(event.target.value as HistoryPeriod); setFrom(""); setTo(""); setDateError(""); })}>{periods.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown size={17} aria-hidden="true" /></label>
    </div>
    {period === "custom" ? <form className={styles.historyCustomRange} onSubmit={applyCustomRange}>
      <label>From <input aria-label="From date" type="date" required value={draftFrom} onChange={event => setDraftFrom(event.target.value)} /></label>
      <label>To <input aria-label="To date" type="date" required value={draftTo} onChange={event => setDraftTo(event.target.value)} /></label>
      <button type="submit" className={styles.button}>Apply Range</button>
      {dateError ? <span role="alert">{dateError}</span> : null}
    </form> : null}
    <div className={styles.tableWrap}>
      <table className={`${styles.table} ${styles.historyTable}`} aria-label="Distribution history">
        <thead><tr>{["Distribution Date", "Store Name", "Location", "Supply Requested", "Status", "Distributed By", "Received By", "Actions"].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{visible.map(distribution => {
          const store = stores.get(distribution.store_id);
          const open = expanded === distribution.id;
          return <Fragment key={distribution.id}>
            <tr className={open ? styles.historySelected : ""}>
              <td>{stamp(distributionTimestamp(distribution))}</td>
              <td><StoreLabel store={store} /></td>
              <td>{store ? location(store) : "—"}</td>
              <td>{distribution.request_id ? <span className={`${styles.badge} ${styles.info}`}>Yes</span> : "No"}</td>
              <td><Status value={distribution.status} /></td>
              <td>{snapshot.names[distribution.distributed_by] ?? "Franchise Admin"}</td>
              <td>{distribution.received_by ? snapshot.names[distribution.received_by] ?? "Store Manager" : "—"}</td>
              <td><button type="button" className={styles.button} aria-expanded={open} aria-controls={`distribution-details-${distribution.id}`} onClick={() => setExpanded(open ? null : distribution.id)}>{open ? "Hide Details" : "View Details"}</button>{snapshot.demo && distribution.status === "in_transit" ? <button type="button" className={styles.button} disabled={mutation.busy} onClick={() => void mutation.run("demo_receive", { distributionId: distribution.id })}>Mark Received (Demo)</button> : null}</td>
            </tr>
            {open ? <tr className={styles.historyExpandedRow}><td colSpan={8}><DistributionDetails distribution={distribution} snapshot={snapshot} /></td></tr> : null}
          </Fragment>;
        })}</tbody>
      </table>
      {!filtered.length ? <p className={styles.empty}>No distributions match these filters.</p> : null}
    </div>
    <Pager page={page} setPage={value => { setPage(value); setExpanded(null); }} count={filtered.length} size={8} />
  </section>;
}
