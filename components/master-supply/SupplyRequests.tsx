"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Clock3, ListFilter, PackageCheck, Search, XCircle } from "lucide-react";
import { FRANCHISE_STORE_IMAGE } from "@/lib/franchise/types";
import type { SupplyRequest, SupplySnapshot, SupplyStore } from "@/lib/master-supply/data";
import { filterSupplyRequests, type RequestPeriod } from "@/lib/master-supply/request-filters";
import { outstandingSupplyRequests } from "@/lib/master-supply/overview-metrics";
import { BASE, location, Notice, number, Pager, ProductLabel, stamp, Status, useSupplyMutation } from "./shared";
import styles from "./MasterSupply.module.css";

const periods: { value: RequestPeriod; label: string }[] = [
  { value: "today", label: "Today" }, { value: "yesterday", label: "Yesterday" },
  { value: "this_week", label: "This Week" }, { value: "last_week", label: "Last Week" },
  { value: "this_month", label: "This Month" }, { value: "last_month", label: "Last Month" },
  { value: "this_year", label: "This Year" }, { value: "all_time", label: "All Time" },
];
const tabs = [
  { key: "all", label: "All Requests", Icon: ListFilter, tone: styles.requestTabAll },
  { key: "pending", label: "Pending", Icon: Clock3, tone: styles.requestTabPending },
  { key: "approved", label: "Approved", Icon: CheckCircle2, tone: styles.requestTabApproved },
  { key: "rejected", label: "Rejected", Icon: XCircle, tone: styles.requestTabRejected },
  { key: "fulfilled", label: "Fulfilled", Icon: PackageCheck, tone: styles.requestTabFulfilled },
];

function RequestStore({ store }: { store?: SupplyStore }) {
  if (!store) return <span className={styles.muted}>Unknown store</span>;
  return <span className={styles.requestStore}>
    <Image src={store.store_image_url || FRANCHISE_STORE_IMAGE} alt="" width={44} height={44} unoptimized />
    <span><strong>{store.name}</strong><small>{location(store)}</small></span>
  </span>;
}

function itemStatus(request: SupplyRequest, approved: number | null, requested: number) {
  if (request.status === "rejected") return "Rejected";
  if (approved === null || request.status === "pending") return "Pending";
  if (approved === 0) return "Not approved";
  if (request.status === "fulfilled" && approved === requested) return "Fulfilled";
  return approved < requested ? "Partially approved" : "Approved";
}

export function SupplyRequests({ snapshot, initialStoreId, initialRequestId }: { snapshot: SupplySnapshot; initialStoreId?: string; initialRequestId?: string }) {
  const linkedRequest = initialRequestId ? snapshot.requests.find(request => request.id === initialRequestId) : undefined;
  const linkedStore = snapshot.stores.find(store => store.id === (initialStoreId || linkedRequest?.store_id));
  const selected = linkedStore && (initialRequestId
    ? linkedRequest?.store_id === linkedStore.id ? linkedRequest : undefined
    : outstandingSupplyRequests(snapshot).filter(request => request.store_id === linkedStore.id).sort((a,b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))[0]);
  const [focused, setFocused] = useState(Boolean(initialStoreId || initialRequestId));
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [storeId, setStoreId] = useState("");
  const [status, setStatus] = useState("");
  const [period, setPeriod] = useState<RequestPeriod>("all_time");
  const [page, setPage] = useState(selected ? Math.floor(snapshot.requests.findIndex(request => request.id === selected.id) / 8) : 0);
  const [expandedId, setExpandedId] = useState<string | null>(selected?.id ?? null);
  const selectedRow = useRef<HTMLTableRowElement>(null);
  const [partial, setPartial] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [validation, setValidation] = useState("");
  const mutation = useSupplyMutation();
  const storeMap = new Map(snapshot.stores.map(store => [store.id, store]));
  const productMap = new Map(snapshot.products.map(product => [product.id, product]));
  const filtered = filterSupplyRequests(snapshot, { tab, search, storeId, status, period });
  const visible = filtered.slice(page * 8, page * 8 + 8);
  const selectedVisible = focused && visible.some(request => request.id === expandedId);
  const targetUnavailable = focused && (!selected || !!expandedId && !snapshot.requests.some(request => request.id === expandedId));
  useEffect(() => {
    if(selectedVisible) selectedRow.current?.scrollIntoView?.({ behavior:"smooth", block:"start" });
  }, [selectedVisible, expandedId]);

  function changeFilter(update: () => void) {
    update(); setFocused(false); setPage(0); setExpandedId(null); setPartial(false); setRejecting(false); setRejectionReason(""); setValidation(""); mutation.clear();
  }
  function reset() {
    changeFilter(() => { setTab("all"); setSearch(""); setStoreId(""); setStatus(""); setPeriod("all_time"); });
  }
  function toggle(request: SupplyRequest) {
    setExpandedId(expandedId === request.id ? null : request.id);
    setPartial(false); setRejecting(false); setRejectionReason(""); setAmounts({}); setValidation(""); mutation.clear();
  }
  async function decide(request: SupplyRequest, decision: "approve" | "partial" | "reject") {
    if (decision === "reject" && !rejectionReason.trim()) { setValidation("Enter a rejection reason."); return; }
    let items: { productId: string; quantity: number }[] = [];
    if (decision === "partial") {
      items = request.master_supply_request_items.map(item => ({
        productId: item.product_id,
        quantity: Number(amounts[item.product_id] ?? item.approved_quantity ?? item.requested_quantity),
      }));
      if (items.some((item, index) => !Number.isInteger(item.quantity) || item.quantity < 0 || item.quantity > request.master_supply_request_items[index].requested_quantity)) {
        setValidation("Enter whole approved units between zero and the requested amount for each product.");
        return;
      }
      if (!items.some(item => item.quantity > 0)) { setValidation("Approve at least one unit."); return; }
    }
    setValidation("");
    const result = await mutation.run("review_request", { requestId: request.id, decision, items, ...(decision === "reject" ? { rejectionReason: rejectionReason.trim() } : {}) });
    if (result.ok) { setPartial(false); setRejecting(false); }
  }

  return <div className={styles.requestPage}>
    <div className={styles.requestTabs} role="group" aria-label="Request status shortcuts">
      {tabs.map(({ key, label, Icon, tone }) => <button key={key} type="button" aria-pressed={tab === key}
        className={`${styles.requestTab} ${tone} ${tab === key ? styles.requestTabActive : ""}`}
        onClick={() => changeFilter(() => setTab(key))}>
        <Icon size={20} aria-hidden="true" /><span>{label}</span><strong>{filterSupplyRequests(snapshot, { tab: key, search: "", storeId: "", status: "", period: "all_time" }).length}</strong>
      </button>)}
    </div>

    <section className={`${styles.panel} ${styles.requestPanel}`} aria-label="Supply requests">
      {targetUnavailable ? <p className={styles.requestUnavailable} role="status">This store&apos;s supply request is no longer available. You can review other requests using the filters below.</p> : null}
      <div className={styles.requestFilters}>
        <label className={styles.requestSearch}><Search size={18} aria-hidden="true" /><input aria-label="Search requests" placeholder="Search store, product or request ID…" value={search} onChange={event => changeFilter(() => setSearch(event.target.value))} /></label>
        <select aria-label="Store" value={storeId} onChange={event => changeFilter(() => setStoreId(event.target.value))}><option value="">All Stores</option>{snapshot.stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}</select>
        <select aria-label="Status" value={status} onChange={event => changeFilter(() => setStatus(event.target.value))}><option value="">All Statuses</option>{["pending", "approved", "partially_approved", "rejected", "fulfilled", "partially_fulfilled"].map(value => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select>
        <select aria-label="Date range" value={period} onChange={event => changeFilter(() => setPeriod(event.target.value as RequestPeriod))}>{periods.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        <button type="button" className={styles.button} onClick={reset}>Clear Filters</button>
      </div>
      <div className={`${styles.tableWrap} ${styles.requestTableWrap}`}><table className={`${styles.table} ${styles.requestTable}`}>
        <thead><tr>{["Store Name", "Request Date", "Products", "Total Units", "Status", "Actions"].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{visible.map(request => {
          const expanded = expandedId === request.id;
          const linked = snapshot.distributions.find(distribution => distribution.request_id === request.id);
          const reviewable = ["pending", "approved", "partially_approved"].includes(request.status) && !linked;
          const convertible = ["approved", "partially_approved"].includes(request.status) && !linked;
          return <Fragment key={request.id}>
            <tr ref={expanded ? selectedRow : undefined} className={expanded ? styles.requestSelected : ""}>
              <td><RequestStore store={storeMap.get(request.store_id)} /></td>
              <td>{stamp(request.created_at)}</td>
              <td>{request.master_supply_request_items.length} products</td>
              <td>{number(request.master_supply_request_items.reduce((sum, item) => sum + item.requested_quantity, 0))}</td>
              <td><Status value={request.status} /></td>
              <td><button type="button" className={styles.button} aria-expanded={expanded} aria-controls={`request-details-${request.id}`} onClick={() => toggle(request)}>{expanded ? "Close Details" : "View Details"}</button></td>
            </tr>
            {expanded ? <tr className={styles.requestExpandedRow}><td colSpan={6}><div id={`request-details-${request.id}`} className={styles.requestExpanded}>
              <h3>Requested Products ({request.master_supply_request_items.length})</h3>
              <p className={styles.muted}>Requested by {snapshot.names[request.requested_by] ?? "Store manager"} · {stamp(request.created_at)}</p>
              {request.notes ? <p className={styles.muted}>Manager notes: {request.notes}</p> : null}
              {request.rejection_reason ? <p className={styles.muted}>Rejection reason: {request.rejection_reason}</p> : null}
              <div className={`${styles.tableWrap} ${styles.requestProducts}`}><table className={styles.table}><thead><tr><th scope="col">Product</th><th scope="col">Requested Units</th><th scope="col">Approved Units</th><th scope="col">Status</th></tr></thead><tbody>
                {request.master_supply_request_items.map(item => <tr key={item.product_id}><td><ProductLabel product={productMap.get(item.product_id)} /></td><td>{number(item.requested_quantity)}</td><td>{partial ? <input className={styles.quantity} aria-label={`Approve ${productMap.get(item.product_id)?.name ?? "product"}`} type="number" min="0" max={item.requested_quantity} step="1" value={amounts[item.product_id] ?? String(item.approved_quantity ?? item.requested_quantity)} onChange={event => { setAmounts(previous => ({ ...previous, [item.product_id]: event.target.value })); setValidation(""); }} /> : item.approved_quantity === null ? "—" : number(item.approved_quantity)}</td><td>{itemStatus(request, item.approved_quantity, item.requested_quantity)}</td></tr>)}
              </tbody></table></div>
              {validation ? <Notice message={validation} error /> : <Notice message={mutation.message} error={mutation.error} />}
              {rejecting ? <div className={styles.field}><label htmlFor={`rejection-${request.id}`}>Rejection reason</label><textarea id={`rejection-${request.id}`} maxLength={500} value={rejectionReason} disabled={mutation.busy} onChange={event => { setRejectionReason(event.target.value); setValidation(""); }}/><div className={styles.requestActions}><button className={`${styles.button} ${styles.danger}`} disabled={mutation.busy || !rejectionReason.trim()} onClick={() => decide(request,"reject")}>Confirm Rejection</button><button className={styles.button} disabled={mutation.busy} onClick={() => setRejecting(false)}>Cancel Rejection</button></div></div> : null}
              <div className={styles.requestActions}>
                {request.status === "pending" && reviewable ? <button type="button" className={`${styles.button} ${styles.primary}`} disabled={mutation.busy} onClick={() => decide(request, "approve")}>Approve Request</button> : null}
                {reviewable ? <button type="button" className={styles.button} disabled={mutation.busy} onClick={() => partial ? decide(request, "partial") : (setPartial(true), setAmounts({}), setValidation(""))}>{partial ? "Save Partial Approval" : "Partially Approve"}</button> : null}
                {partial ? <button type="button" className={styles.button} onClick={() => { setPartial(false); setValidation(""); }}>Cancel Edit</button> : null}
                {reviewable ? <button type="button" className={`${styles.button} ${styles.danger}`} disabled={mutation.busy} onClick={() => { setRejecting(true); setPartial(false); }}>Reject Request</button> : null}
                {convertible ? <Link className={`${styles.button} ${styles.requestConvert}`} href={`${BASE}/distribute?requestId=${request.id}` as never}>Convert to Distribution</Link> : null}
              </div>
            </div></td></tr> : null}
          </Fragment>;
        })}</tbody>
      </table>{!filtered.length ? <p className={styles.empty}>No requests match these filters.</p> : null}</div>
      <Pager page={page} setPage={value => { setPage(value); setExpandedId(null); setPartial(false); }} count={filtered.length} size={8} />
    </section>
  </div>;
}
