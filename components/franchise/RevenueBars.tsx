"use client";

import { useId, useState } from "react";
import { RevenueGrid, RevenueYAxis } from "./ChartAxes";
import { axisWidth, chartMoney, plotBottom, plotTop, revenueScale } from "./chart-scale";
import { useChartWidth } from "./use-chart-width";
import styles from "./Franchise.module.css";

export function RevenueBars({ values, title, expanded = false }: { values: { label: string; value: number }[]; title: string; expanded?: boolean }) {
  const { ref, width } = useChartWidth();
  const gradient = useId();
  const [requestedPage, setPage] = useState(0);
  const scale = revenueScale(values.map((v) => v.value));
  const height = expanded ? 440 : 200;
  const bottom = plotBottom + height - 200;
  const plotWidth = Math.max(1, width - axisWidth);
  const labelWidth = Math.max(100, ...values.map((v) => Math.max(
    chartMoney.format(v.value).length * 7 + 12,
    Math.min(180, v.label.length * 3.5 + 12),
  )));
  const capacity = Math.max(1, Math.floor(plotWidth / labelWidth));
  const pages = Math.ceil(values.length / capacity);
  const page = Math.min(requestedPage, pages - 1);
  const offset = page * capacity;
  const visible = values.slice(offset, offset + capacity);
  const slot = plotWidth / visible.length;
  const barWidth = expanded ? Math.min(96, slot * .64) : slot * .64;

  return <div ref={ref} className={`${styles.chartFrame} ${expanded ? styles.expandedBarFrame : ""}`} style={expanded ? { height: height + 12 } : undefined} role="group" aria-label={`${title} revenue chart`}>
    <RevenueYAxis ticks={scale.ticks} max={scale.max} height={height} />
    {pages > 1 ? <nav className={styles.barPages} aria-label={`${title} chart pages`}>
      <span>{offset + 1}–{offset + visible.length} of {values.length}</span>
      <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label={`Previous ${title} bars`}>←</button>
      <button type="button" disabled={page === pages - 1} onClick={() => setPage(page + 1)} aria-label={`Next ${title} bars`}>→</button>
    </nav> : null}
    <div className={styles.barPlot}>
      <svg width="100%" height={height - 42} viewBox={`0 0 ${plotWidth} ${height - 42}`}>
        <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#36d681" /><stop offset="100%" stopColor="#075d3b" />
        </linearGradient></defs>
        <RevenueGrid ticks={scale.ticks} max={scale.max} width={plotWidth} height={height} />
        {visible.map((v, i) => {
          const x = slot * (i + .5);
          const y = bottom - (v.value / scale.max) * (bottom - plotTop);
          return <g key={`${v.label}-${i}`} aria-label={`${v.label}: ${chartMoney.format(v.value)}`}>
            <title>{v.label}: {chartMoney.format(v.value)}</title>
            <rect x={x - barWidth / 2} y={v.value === 0 ? bottom - 2 : y} width={barWidth} height={Math.max(2, bottom - y)} rx="3" fill={`url(#${gradient})`} />
            <text x={x} y={y - 9} textAnchor="middle" className={styles.pointValue}>{chartMoney.format(v.value)}</text>
            <line x1={x} x2={x} y1={bottom} y2={bottom + 5} className={styles.axisLine} />
          </g>;
        })}
      </svg>
      <div className={styles.barNames} style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(0, 1fr))` }}>
        {visible.map((v, i) => <span key={`${v.label}-${i}`} title={v.label}>{v.label}</span>)}
      </div>
    </div>
  </div>;
}
