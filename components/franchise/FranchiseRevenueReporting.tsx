"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Maximize2, X } from "lucide-react";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import type { DailySnapshot } from "@/lib/franchise/overview-periods";
import { aggregateRevenuePeriods, currentRevenueSelection, defaultRevenueSelection, revenueReportingRange, revenueReportingTitle, revenueViews, validateRevenueSelection, type RevenueSelection } from "@/lib/franchise/revenue-reporting";
import { localDay } from "@/lib/franchise/reporting";
import { RevenueChart } from "./UI";
import styles from "./Franchise.module.css";
import { useExpandedGraph } from "./use-expanded-graph";

export function FranchiseRevenueReporting({ snapshot, historyStart, now, loadRange, onRange, reportName = "Franchise Revenue", preferenceKey = "greenchoice.sales.v3.reporting.franchise" }: {
  snapshot: DailySnapshot;
  historyStart: string | null;
  now: string;
  loadRange: (range: { from: string; to: string }) => Promise<DailySnapshot>;
  onRange?: (range: { from: string; to: string }) => void;
  reportName?: string;
  preferenceKey?: string;
}) {
  const id = useId();
  const router = useRouter();
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") router.refresh(); };
    const timer = setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [router]);
  const { dialog, expandButton, expanded, setExpanded } = useExpandedGraph();
  const time = new Date(now);
  const initial = defaultRevenueSelection(time);
  const [selection, setSelection] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [data, setData] = useState(snapshot);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);
  const wanted = useRef(initial);
  useEffect(() => () => { request.current += 1; }, []);

  async function choose(next: RevenueSelection) {
    const sequence = ++request.current;
    wanted.current = next;
    setDraft(next);
    setError("");
    setPending(true);
    try {
      validateRevenueSelection(next, historyStart, time);
      const range = revenueReportingRange(next, historyStart, time);
      const result = await loadRange(range);
      if (sequence !== request.current) return;
      setData(result);
      setSelection(next);
      onRange?.(range);
      try { sessionStorage.setItem(preferenceKey, JSON.stringify({ selection: next, calendarDay: localDay(time) })); } catch { /* Optional preference storage. */ }
    } catch {
      if (sequence === request.current) setError("This report could not be loaded. Please retry.");
    } finally {
      if (sequence === request.current) setPending(false);
    }
  }
  useEffect(() => {
    let cancelled = false;
    try {
      const saved = sessionStorage.getItem(preferenceKey);
      let restored = defaultRevenueSelection(new Date(now));
      if (saved) {
        try {
          const preference = JSON.parse(saved);
          if (preference.calendarDay === localDay(now)) restored = currentRevenueSelection(validateRevenueSelection(preference.selection, historyStart, new Date(now)).view, new Date(now));
        } catch { /* Changed history or old preferences use the current calendar. */ }
      }
      const range = revenueReportingRange(restored, historyStart, new Date(now));
      const sequence = ++request.current;
      wanted.current = restored;
      void Promise.resolve().then(() => {
        if (cancelled) return undefined;
        setPending(true);
        return loadRange(range);
      }).then((result) => {
        if (cancelled || !result || sequence !== request.current) return;
        setData(result); setSelection(restored); setDraft(restored); onRange?.(range);
      }).catch(() => {
        if (!cancelled && sequence === request.current) setError("This report could not be loaded. Please retry.");
      }).finally(() => { if (!cancelled && sequence === request.current) setPending(false); });
    } catch { /* Ignore obsolete date preferences. */ }
    return () => { cancelled = true; };
  }, [historyStart, now, loadRange, onRange, preferenceKey]);
  let activeSelection = selection;
  try { validateRevenueSelection(activeSelection, historyStart, time); }
  catch { activeSelection = initial; }
  const points = aggregateRevenuePeriods(data.daily, activeSelection, historyStart, time);
  const title = revenueReportingTitle(activeSelection);
  const controlId = `${id}-${expanded ? "expanded" : "inline"}`;
  const header = <>
    <div className={styles.filterHeader}>
      <div><h2 id={`${controlId}-title`}>{reportName}</h2><p className={styles.periodIndicator} aria-live="polite">{title}</p></div>
      <div className={`${styles.periodSelector} ${styles.revenueFilters}`}>
        <label className={styles.visuallyHidden} htmlFor={`${controlId}-view`}>{reportName} period</label>
        <select id={`${controlId}-view`} className={styles.select} value={draft.view} onChange={(e) => {
          const view = e.target.value as RevenueSelection["view"];
          void choose(currentRevenueSelection(view, time));
        }}>
          {revenueViews.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {expanded ? <button type="button" className={`${styles.button} ${styles.revenueIconButton}`} aria-label="Close expanded revenue graph" onClick={() => setExpanded(false)}><X size={18} /></button>
          : <button type="button" ref={expandButton} className={`${styles.button} ${styles.revenueIconButton}`} aria-label={`Expand ${reportName.toLowerCase()} graph`} aria-haspopup="dialog" onClick={() => setExpanded(true)}><Maximize2 size={18} /></button>}
      </div>
    </div>
    <p className={styles.periodIndicator}>{selection.view === "weeks" ? "ISO weeks: Monday–Sunday. Cross-year dates are included in the named week." : "Completed sales in Africa/Johannesburg time."}{points.some((point) => point.tooltipLabel?.includes("(in progress)")) ? " Current period is in progress." : ""}</p>
    {error ? <div role="alert" className={styles.filterError}>{error} <button className={styles.button} onClick={() => void choose(wanted.current)}>Retry</button></div> : null}
  </>;
  const axisTitle = { days: "Day", weeks: "Week", months: "Month", years: "Year" }[selection.view];
  return <div role="region" aria-label={reportName} aria-busy={pending} className={styles.filterSection}>
    <LoadingOverlay active={pending} label={`Loading ${reportName.toLowerCase()} report`} />
    <RevenueChart values={points} title={title} header={expanded ? <><h2>{reportName}</h2><p className={styles.periodIndicator}>{title}</p></> : header} xAxisTitle={axisTitle} emptyMessage={!historyStart ? `No sales recorded yet. Your revenue analytics will appear once ${reportName === "Store Revenue" ? "this store" : "your franchise"} completes its first sale.` : undefined} />
    <dialog ref={dialog} className={styles.revenueDialog} aria-labelledby={`${id}-expanded-title`} onCancel={() => setExpanded(false)} onClose={() => setExpanded(false)}>
      {expanded ? <div aria-busy={pending}>
        <LoadingOverlay active={pending} label={`Loading expanded ${reportName.toLowerCase()} report`} />
        <RevenueChart values={points} title={title} header={header} xAxisTitle={axisTitle} fitPeriod emptyMessage={!historyStart ? `No sales recorded yet. Your revenue analytics will appear once ${reportName === "Store Revenue" ? "this store" : "your franchise"} completes its first sale.` : undefined} />
      </div> : null}
    </dialog>
  </div>;
}
