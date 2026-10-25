"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "./Franchise.module.css";
import { RevenueGrid, RevenueYAxis } from "./ChartAxes";
import { axisWidth, chartMoney as formatter, plotBottom, plotTop, revenueDateTicks, revenueScale } from "./chart-scale";
import { useChartWidth } from "./use-chart-width";
import type { RevenuePoint } from "@/lib/franchise/revenue-reporting";


export function RevenuePlot({ values, title, period, xAxisTitle, fitPeriod = false }: {
  values: RevenuePoint[];
  title: string;
  period?: { preset: string; from: string; to: string };
  xAxisTitle?: string;
  fitPeriod?: boolean;
}) {
  const gradient = useId();
  const scroll = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const { ref, width: availableWidth } = useChartWidth();
  const peak = Math.max(0, ...values.map((v) => v.value ?? 0));
  const scale = revenueScale(values.map((v) => v.value ?? 0));
  const dates = xAxisTitle ? { title: xAxisTitle, ticks: values.map((v, index) => ({ index, label: v.label })) } : revenueDateTicks(values.map((v) => v.label), period);
  // Fit the period when possible, but reserve label space in both chart sizes.
  // Dense periods scroll rather than hiding or overlapping permanent amounts.
  const spacing = Math.max(100, ...values.map((v) => formatter.format(v.value ?? 0).length * 8 + 20));
  const width = Math.max(availableWidth - axisWidth, values.length * spacing);
  const height = fitPeriod ? 380 : 200;
  const bottom = plotBottom + height - 200;
  const inset = spacing / 2;
  const tickSpacing = xAxisTitle === "Day" ? 30 : xAxisTitle === "Year" ? 48 : 82;
  const tickStep = fitPeriod ? Math.max(1, Math.ceil(values.length * tickSpacing / width)) : 1;
  const points = values.map((v, i) => ({
    ...v,
    x: values.length === 1 ? width / 2 : inset + i * (width - 2 * inset) / (values.length - 1),
    y: bottom - ((v.value ?? 0) / scale.max) * (bottom - plotTop),
  }));
  const available = points.filter((p) => p.value !== null);
  const earned = available.filter((point) => (point.value ?? 0) > 0);
  const latestX = (earned[earned.length - 1] || available[available.length - 1])?.x ?? 0;
  const periodKey = `${title}:${values.map((value) => `${value.label}:${value.value}`).join("|")}`;
  useEffect(() => {
    const viewport = scroll.current;
    if (viewport) viewport.scrollLeft = Math.max(0, latestX + spacing / 2 - viewport.clientWidth);
  }, [periodKey, width, latestX, spacing]);
  const line = available.map((p) => `${p.x},${p.y}`).join(" ");
  const dateTicks: typeof dates.ticks = [];
  for (const tick of dates.ticks) {
    if (fitPeriod && tick.index % tickStep !== 0 && tick.index !== values.length - 1) continue;
    if (fitPeriod && tick.index === values.length - 1 && values.length > 1 && tick.index % tickStep !== 0) dateTicks.pop();
    const previous = dateTicks[dateTicks.length - 1];
    if (xAxisTitle || !previous || points[tick.index].x - points[previous.index].x >= Math.max(120, width / 8)) dateTicks.push(tick);
  }
  return (
    <div ref={ref} className={styles.chartFrame} style={{ height }}>
    <RevenueYAxis ticks={scale.ticks} max={scale.max} height={height} />
    <div ref={scroll} className={styles.chartScroll} style={{ height }} tabIndex={0} aria-label={`${title} chart. ${width > availableWidth - axisWidth ? "Scroll horizontally to see all dates and revenue values." : "Entire selected period."}`}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height, minWidth: "100%" }} className={styles.revenuePlot} role="group" aria-label={`${title}. Peak ${xAxisTitle ? "period" : "daily"} revenue ${formatter.format(peak)}.`}>
        <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4edd82" stopOpacity=".38" />
          <stop offset="100%" stopColor="#4edd82" stopOpacity="0" />
        </linearGradient></defs>
        <RevenueGrid ticks={scale.ticks} max={scale.max} width={width} height={height} />
        {available.length > 1 ? <>
          <polygon points={`${available[0].x},${bottom} ${line} ${available[available.length - 1].x},${bottom}`} fill={`url(#${gradient})`} />
          <polyline points={line} fill="none" stroke="#73ee93" strokeWidth="2.5" />
        </> : null}
        {points.map((p) => {
          if (p.value === null) return fitPeriod ? null : <text key={p.label} x={p.x} y={bottom - 12} textAnchor="middle" className={styles.axisLabel}>{p.unavailableLabel || "Not started"}</text>;
          const amount = formatter.format(p.value);
          const tooltip = p.tooltipLabel || p.label;
          const tooltipText = tooltip.split(" (in progress)")[0];
          const tooltipWidth = Math.min(width, Math.max(fitPeriod ? 140 : spacing - 8, tooltipText.length * 6.5 + 16));
          const tooltipX = Math.max(0, Math.min(width - tooltipWidth, p.x - tooltipWidth / 2));
          const tooltipCenter = tooltipX + tooltipWidth / 2;
          const active = selected === p.label;
          return <g key={p.label}>
            <text x={p.x} y={p.y - 12} textAnchor="middle" className={styles.pointValue} pointerEvents="none">{amount}</text>
            <circle cx={p.x} cy={p.y} r="5" pointerEvents="none" fill="#73ee93" stroke="#123321" strokeWidth="2" />
            <circle cx={p.x} cy={p.y} r={fitPeriod ? Math.max(2, Math.min(12, (width - 2 * inset) / Math.max(1, values.length - 1) / 2)) : 12} fill="transparent" role="button" tabIndex={0} aria-label={`${tooltip}: ${amount}`} aria-pressed={active}
              className={styles.chartPoint}
              onMouseEnter={() => setSelected(p.label)} onMouseLeave={() => setSelected(null)}
              onFocus={() => setSelected(p.label)} onBlur={() => setSelected(null)}
              onClick={() => setSelected(p.label)} onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(p.label); }
                if (e.key === "Escape") setSelected(null);
              }}><title>{tooltip}: {amount}</title></circle>
            {active ? <g role="tooltip" pointerEvents="none">
              <rect x={tooltipX} y={Math.max(2, p.y - 70)} width={tooltipWidth} height="38" rx="6" fill="#071b10" stroke="#73ee93" />
              <text x={tooltipCenter} y={Math.max(2, p.y - 70) + 15} textAnchor="middle" fill="#fff" fontSize="12">{tooltipText}</text>
              <text x={tooltipCenter} y={Math.max(2, p.y - 70) + 30} textAnchor="middle" fill="#73ee93" fontSize="12">{amount}</text>
            </g> : null}
          </g>;
        })}
        {dateTicks.map((tick) => <g key={tick.index} className={styles.dateTick} pointerEvents="none">
          <line x1={points[tick.index].x} x2={points[tick.index].x} y1={bottom} y2={bottom + 5} className={styles.axisLine} />
          <text x={points[tick.index].x} y={bottom + 25} textAnchor="middle" className={styles.axisLabel}>{fitPeriod && xAxisTitle === "Day" ? tick.label.replace("Day ", "") : fitPeriod && xAxisTitle === "Week" ? tick.label.replace("Week ", "W") : fitPeriod && xAxisTitle === "Month" ? tick.label.slice(0, 3) : tick.label}</text>
        </g>)}
      </svg>
    </div>
    <span className={styles.xAxisTitle}>{dates.title}</span>
    </div>
  );
}
