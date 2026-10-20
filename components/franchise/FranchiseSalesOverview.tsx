"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Maximize2, X } from "lucide-react";
import { useExpandedGraph } from "./use-expanded-graph";
import { loadFranchiseHistoricalSalesRange } from "@/app/dashboard/franchise/sales/actions";
import {
  createOverviewRangeLoader,
  overviewPeriod,
  overviewPeriodLabel,
  overviewPresets,
  periodStoreTotals,
  type DailySnapshot,
  type OverviewPeriod,
  type OverviewPreset,
} from "@/lib/franchise/overview-periods";
import {
  BarChart,
  Kpis,
} from "./UI";
import styles from "./Franchise.module.css";
import { notifySalesLoading, salesLoadingReady } from "./sales-loading-events";
import { FranchiseRevenueReporting } from "./FranchiseRevenueReporting";
import { defaultRevenueSelection, revenueReportingRange } from "@/lib/franchise/revenue-reporting";
import { LoadingOverlay } from "@/components/LoadingOverlay";

import { StorePerformanceTable, type StoreRow } from "./StorePerformanceTable";
export function FilteredSection<T extends { from: string; to: string }>({
  title,
  initialPeriod,
  initialSnapshot,
  now,
  loadRange,
  rememberKey,
  historyStart,
  comparisonRange,
  headerControls,
  expandable = false,
  children,
}: {
  title: string;
  initialPeriod: OverviewPeriod;
  initialSnapshot: T;
  now: string;
  loadRange: (period: OverviewPeriod) => Promise<T>;
  rememberKey?: string;
  historyStart?: string | null;
  comparisonRange?: { from: string; to: string };
  headerControls?: React.ReactNode;
  expandable?: boolean;
  children: (
    period: OverviewPeriod,
    snapshot: T,
    header: React.ReactNode,
    revenueControl: React.ReactNode,
    expanded: boolean,
  ) => React.ReactNode;
}) {
  const id = useId();
  const { dialog, expandButton, expanded, setExpanded } = useExpandedGraph();
  const [period, setPeriod] = useState(initialPeriod),
    [snapshot, setSnapshot] = useState(initialSnapshot);
  const [preset, setPreset] = useState(initialPeriod.preset);
  const [from, setFrom] = useState(initialPeriod.from),
    [to, setTo] = useState(initialPeriod.to);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const request = useRef(0),
    wanted = useRef(initialPeriod);
  const mountedAt = useRef(0);
  useEffect(() => {
    mountedAt.current = Date.now();
  }, [now]);
  const currentTime = () =>
    new Date(
      Date.parse(now) +
        (mountedAt.current ? Date.now() - mountedAt.current : 0),
    );
  async function apply(next: OverviewPeriod) {
    const sequence = ++request.current;
    wanted.current = next;
    setPending(true);
    setError("");
    try {
      const data = await loadRange(next);
      if (sequence !== request.current) return;
      setPeriod(next);
      setSnapshot(data);
      if (rememberKey) {
        try { sessionStorage.setItem(rememberKey, JSON.stringify(next)); } catch { /* Storage may be disabled. */ }
      }
    } catch {
      if (sequence === request.current)
        setError("This period could not be loaded. Please retry.");
    } finally {
      if (sequence === request.current) setPending(false);
    }
  }
  useEffect(() => {
    if (!rememberKey) return;
    let cancelled = false;
    try {
      const saved = sessionStorage.getItem(rememberKey);
      if (!saved) return;
      const input = JSON.parse(saved) as OverviewPeriod;
      if (!overviewPresets.some(([value]) => value === input.preset)) return;
      const restored = overviewPeriod(input.preset, input, new Date(now), historyStart);
      if (restored.from === initialPeriod.from && restored.to === initialPeriod.to && restored.preset === initialPeriod.preset) return;
      const sequence = ++request.current;
      wanted.current = restored;
      void loadRange(restored).then((data) => {
        if (cancelled || sequence !== request.current) return;
        setPeriod(restored);
        setSnapshot(data);
        setPreset(restored.preset);
        setFrom(restored.from);
        setTo(restored.to);
      }).catch(() => {
        if (!cancelled && sequence === request.current)
          setError("This period could not be loaded. Please retry.");
      });
    } catch { /* Ignore obsolete or unavailable date preferences. */ }
    return () => { cancelled = true; };
  }, [rememberKey, loadRange, now, historyStart, initialPeriod.from, initialPeriod.to, initialPeriod.preset]);
  function choose(value: OverviewPreset) {
    setPreset(value);
    setError("");
    if (value === "custom") {
      // Choosing custom edits a draft; the last valid period stays visible until Apply.
      ++request.current;
      setPending(false);
      setFrom(period.from);
      setTo(period.to);
    } else void apply(overviewPeriod(value, {}, currentTime()));
  }
  const header = (
    <>
      <div className={styles.filterHeader}>
        <div>
          <h2 id={`${id}-title`}>{title}</h2>
          <p className={styles.periodIndicator} aria-live="polite">
            {overviewPeriodLabel(period)}
          </p>
        </div>
        <div className={`${styles.periodSelector} ${expandable ? styles.expandedGraphControls : ""}`}>
          {comparisonRange ? <button className={styles.button} disabled={pending} onClick={() => {
            setPreset("custom"); setFrom(comparisonRange.from); setTo(comparisonRange.to);
            void apply(overviewPeriod("custom", comparisonRange, currentTime(), historyStart));
          }}>Use revenue range</button> : null}
          <label htmlFor={`${id}-preset`} className={styles.visuallyHidden}>
            {title} period
          </label>
          <select
            id={`${id}-preset`}
            className={styles.select}
            value={preset}
            onChange={(e) => choose(e.target.value as OverviewPreset)}
          >
            {overviewPresets.map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
          {headerControls}
          {expandable ? expanded
            ? <button type="button" className={`${styles.button} ${styles.revenueIconButton}`} aria-label={`Close expanded ${title.toLowerCase()} graph`} onClick={() => setExpanded(false)}><X size={18} /></button>
            : <button type="button" ref={expandButton} className={`${styles.button} ${styles.revenueIconButton}`} aria-label={`Expand ${title.toLowerCase()} graph`} aria-haspopup="dialog" onClick={() => setExpanded(true)}><Maximize2 size={18} /></button>
            : null}
          {pending ? (
            <span role="status" className={styles.periodIndicator}>
              Updating…
            </span>
          ) : null}
        </div>
      </div>
      {preset === "custom" ? (
        <form
          className={styles.filterDates}
          onSubmit={(e) => {
            e.preventDefault();
            try {
              void apply(overviewPeriod("custom", { from, to }, currentTime(), historyStart));
            } catch {
              setError(
                historyStart === undefined
                  ? "Choose valid dates, in order, within a period of up to one year."
                  : "Choose valid dates, in order, within available sales history and through today.",
              );
            }
          }}
        >
          <label className={styles.field} htmlFor={`${id}-from`}>
            From
            <input
              id={`${id}-from`}
              aria-label={`${title} from`}
              type="date"
              max={historyStart === undefined ? undefined : overviewPeriod("today", {}, new Date(now)).to}
              value={from}
              required
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className={styles.field} htmlFor={`${id}-to`}>
            To
            <input
              id={`${id}-to`}
              aria-label={`${title} to`}
              type="date"
              max={historyStart === undefined ? undefined : overviewPeriod("today", {}, new Date(now)).to}
              value={to}
              required
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <button className={styles.button} disabled={pending}>
            Apply
          </button>
        </form>
      ) : null}
      {error ? (
        <div role="alert" className={styles.filterError}>
          {error}{" "}
          {error.includes("retry") ? (
            <button
              className={styles.button}
              onClick={() => void apply(wanted.current)}
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
  const revenueControl = <select className={styles.select} aria-label="Store revenue period" title="Current South African calendar period; use the date range above for historical dates" value={period.preset} onChange={(event) => choose(event.target.value as OverviewPreset)}>
    <option value="today">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option><option value="year">Yearly</option>
    {period.preset === "custom" ? <option value="custom" disabled>Custom range</option> : null}
  </select>;
  return (
    <div
      role="region"
      aria-label={title}
      aria-busy={pending}
      className={styles.filterSection}
    >
      {expanded ? <section className={styles.panel}><h2>{title}</h2><p className={styles.periodIndicator}>{overviewPeriodLabel(period)}</p></section>
        : children(period, snapshot, header, revenueControl, false)}
      {expandable ? <dialog ref={dialog} className={styles.revenueDialog} aria-labelledby={`${id}-title`} onCancel={() => setExpanded(false)} onClose={() => setExpanded(false)}>
        {expanded ? <div aria-busy={pending}>
          {children(period, snapshot, header, revenueControl, true)}
          <LoadingOverlay active={pending} label={`Loading ${title}`} />
        </div> : null}
      </dialog> : null}
      {!expanded && historyStart !== undefined ? <LoadingOverlay active={pending} label={`Loading ${title}`} /> : null}
    </div>
  );
}

export function FranchiseSalesOverview({
  snapshot,
  stores,
  kpis,
  tablePeriod,
  now,
  historyStart,
}: {
  snapshot: DailySnapshot;
  stores: StoreRow[];
  kpis: { label: string; value: number; currency?: boolean }[];
  tablePeriod: { from: string; to: string };
  now: string;
  historyStart: string | null;
}) {
  useEffect(() => { notifySalesLoading(salesLoadingReady); }, []);
  const loadRange = useMemo(
    () => createOverviewRangeLoader(snapshot, async (range) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([loadFranchiseHistoricalSalesRange(range), new Promise<DailySnapshot>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Reporting request timed out.")), 120_000);
        })]);
      } finally { clearTimeout(timer); }
    }),
    [snapshot],
  );
  const [storeSearch, setStoreSearch] = useState("");
  const month = overviewPeriod("month", {}, new Date(now));
  const [comparisonRange, setComparisonRange] = useState(() => revenueReportingRange(defaultRevenueSelection(new Date(now)), historyStart, new Date(now)));
  const initialTable =
    tablePeriod.from === month.from && tablePeriod.to === month.to
      ? month
      : overviewPeriod("custom", tablePeriod, new Date(now), historyStart);
  return (
    <div className={styles.salesOverview}>
      <Kpis values={kpis} compact />
      <p className={styles.salesNote}>
        Revenue cards use the current South African calendar periods. Customers
        are registered store records. Each section has its own period. Use revenue range in Store Performance to compare its dates with the chart. Future periods have no recorded result.
      </p>
      <div className={styles.charts}>
        <FranchiseRevenueReporting snapshot={snapshot} historyStart={historyStart} now={now} loadRange={loadRange} onRange={setComparisonRange} />
        <FilteredSection
          title="Sales by Store"
          expandable
          historyStart={historyStart}
          rememberKey="greenchoice.sales.v1.stores"
          initialPeriod={month}
          initialSnapshot={snapshot}
          now={now}
          loadRange={loadRange}
        >
          {(period, data, header, _revenueControl, expanded) => {
            const totals = periodStoreTotals(data.daily, period);
            return (
              <BarChart
                title="Sales by Store"
                expanded={expanded}
                values={stores.map((p) => ({
                  label: p.store.name,
                  value: totals.get(p.store.id)?.revenue || 0,
                }))}
                header={header}
              />
            );
          }}
        </FilteredSection>
      </div>
      <FilteredSection
        title="Store Performance"
        headerControls={<input type="search" className={styles.performanceSearch} aria-label="Search stores" placeholder="Search stores..." value={storeSearch} onChange={(event) => setStoreSearch(event.target.value)} />}
        historyStart={historyStart}
        comparisonRange={comparisonRange}
        rememberKey="greenchoice.sales.v1.table"
        initialPeriod={initialTable}
        initialSnapshot={snapshot}
        now={now}
        loadRange={loadRange}
      >
        {(period, data, header, revenueControl) => (
          <StorePerformanceTable
            stores={stores}
            period={period}
            snapshot={data}
            header={header}
            search={storeSearch}
            revenueControl={revenueControl}
          />
        )}
      </FilteredSection>
    </div>
  );
}
