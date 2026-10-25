import { axisRevenueLabel, axisWidth, chartMoney, plotBottom, plotTop } from "./chart-scale";
import styles from "./Franchise.module.css";

export function RevenueYAxis({ ticks, max, height = 200 }: { ticks: number[]; max: number; height?: number }) {
  const bottom = plotBottom + height - 200;
  return <svg className={styles.revenueYAxis} width={axisWidth} height={height} viewBox={`0 0 ${axisWidth} ${height}`} role="img" aria-label="Revenue axis in South African rand">
    <text x="0" y="14" className={styles.axisLabel}>Revenue (R)</text>
    {ticks.map((value) => <text key={value} x={axisWidth - 8} y={bottom - value / max * (bottom - plotTop)} dominantBaseline="middle" textAnchor="end" className={styles.axisLabel}>
      <title>{chartMoney.format(value)}</title>{axisRevenueLabel(value)}
    </text>)}
    <line x1={axisWidth - 1} x2={axisWidth - 1} y1={plotTop} y2={bottom} className={styles.axisLine} />
  </svg>;
}

export function RevenueGrid({ ticks, max, width, height = 200 }: { ticks: number[]; max: number; width: number; height?: number }) {
  const bottom = plotBottom + height - 200;
  return <g aria-hidden="true">{ticks.map((value) => {
    const y = bottom - value / max * (bottom - plotTop);
    return <line key={value} x1="0" x2={width} y1={y} y2={y} className={value === 0 ? styles.axisLine : styles.chartGrid} />;
  })}</g>;
}
