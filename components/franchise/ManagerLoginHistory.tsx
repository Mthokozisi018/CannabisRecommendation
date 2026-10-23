"use client";

import { useRef, useState } from "react";
import { loadManagerLoginHistory } from "@/app/dashboard/franchise/stores/login-history-actions";
import type { ManagerLoginFilters, ManagerLoginPage } from "@/lib/franchise/manager-login-history";
import type { FranchiseStaff } from "@/lib/franchise/types";
import styles from "./Franchise.module.css";

const timestamp = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
const managerName = (person?: FranchiseStaff) => person?.full_name?.trim() || [person?.first_name, person?.surname].filter(Boolean).join(" ") || "Name not recorded";
export function ManagerLoginHistory({ storeId, managers, initialPage }: { storeId: string; managers: FranchiseStaff[]; initialPage: ManagerLoginPage }) {
  const [report, setReport] = useState(initialPage);
  const [draft, setDraft] = useState(initialPage.filters);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const sequence = useRef(0);
  async function load(filters: ManagerLoginFilters) {
    const request = ++sequence.current;
    setPending(true);
    setError("");
    try {
      const next = await loadManagerLoginHistory(storeId, filters);
      if (request === sequence.current) { setReport(next); setDraft(next.filters); }
    } catch {
      if (request === sequence.current) setError("Login history could not be loaded. Check the dates and try again.");
    } finally {
      if (request === sequence.current) setPending(false);
    }
  }
  return <section className={`${styles.panel} ${styles.loginHistory}`} aria-label="Manager Login History" aria-busy={pending}>
    <div className={styles.filterHeader}>
      <div><h2>Manager Login History</h2><p className={styles.periodIndicator}>South African time (SAST). The current audit system records successful logins. Older events may not include IP or browser details.</p></div>
      <button type="button" className={styles.button} disabled={pending} onClick={() => void load(report.filters)}>Refresh history</button>
    </div>
    <form className={styles.loginFilters} onSubmit={event => { event.preventDefault(); void load({ ...draft, page: 1 }); }}>
      <label className={styles.field}>From<input disabled={pending} type="date" value={draft.from} onChange={event => setDraft({ ...draft, from: event.target.value })} /></label>
      <label className={styles.field}>To<input disabled={pending} type="date" min={draft.from || undefined} value={draft.to} onChange={event => setDraft({ ...draft, to: event.target.value })} /></label>
      <label className={styles.field}>Manager<select disabled={pending} value={draft.manager} onChange={event => setDraft({ ...draft, manager: event.target.value })}><option value="">All managers</option>{managers.map(manager => <option key={manager.auth_user_id} value={manager.auth_user_id}>{managerName(manager)}</option>)}</select></label>
      <label className={styles.field}>Login status<select disabled={pending} value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value as ManagerLoginFilters["status"] })}><option value="all">All recorded statuses</option><option value="success">Successful</option></select></label>
      <button className={styles.button} disabled={pending}>Apply filters</button>
    </form>
    {error ? <p role="alert" className={styles.filterError}>{error}</p> : null}
    <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Manager login records">
      <table className={`${styles.table} ${styles.loginTable}`}>
        <thead><tr>{["Manager", "Date & Time", "IP Address", "Device / Browser", "Status"].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{report.rows.length ? report.rows.map(record => <tr key={record.id}>
          <td>{managerName(managers.find(manager => manager.auth_user_id === record.user_id))}</td>
          <td><time dateTime={record.created_at}>{timestamp.format(new Date(record.created_at))}</time></td>
          <td>{record.details?.ipAddress || "Not recorded"}</td>
          <td className={styles.loginDevice}>{record.details?.userAgent || "Not recorded"}</td>
          <td>{record.result === "success" ? "Successful" : record.result || "Not recorded"}</td>
        </tr>) : <tr><td colSpan={5} className={styles.loginEmpty}>{report.filters.from || report.filters.to || report.filters.manager || report.filters.status !== "all" ? "No manager login activity matches these filters." : "No manager login activity recorded for this store."}</td></tr>}</tbody>
      </table>
    </div>
    <div className={styles.loginPagination}>
      <span role="status" aria-live="polite">{pending ? "Loading login history..." : `Page ${report.filters.page} - ${report.rows.length} records`}</span>
      <button type="button" className={styles.button} disabled={pending || report.filters.page === 1} onClick={() => void load({ ...report.filters, page: report.filters.page - 1 })}>Previous</button>
      <button type="button" className={styles.button} disabled={pending || !report.hasNext} onClick={() => void load({ ...report.filters, page: report.filters.page + 1 })}>Next</button>
    </div>
  </section>;
}
