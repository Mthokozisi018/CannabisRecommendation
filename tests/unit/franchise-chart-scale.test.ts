import { expect, it } from "vitest";
import { plotBottom, plotTop, revenueDateTicks, revenueScale } from "@/components/franchise/chart-scale";

it.each([[0], [.01], [.3, 25.1], [148.55], [1576774.7], [9_876_543_210.12]].map((values) => ({ values })))("uses readable equal rand intervals above all values: $values", ({ values }) => {
  const scale = revenueScale(values);
  expect(scale.max).toBeGreaterThanOrEqual(Math.max(...values));
  expect(scale.ticks).toHaveLength(5);
  expect(scale.ticks[0]).toBe(0);
  expect(scale.ticks[4]).toBeCloseTo(scale.max);
  const step = scale.ticks[1];
  expect(step).toBeGreaterThanOrEqual(.01);
  for (let i = 1; i < scale.ticks.length; i++) expect(scale.ticks[i] - scale.ticks[i - 1]).toBeCloseTo(step);
  expect(scale.y(0)).toBe(plotBottom);
  expect(scale.y(scale.max)).toBe(plotTop);
});

it("changes date ticks to weeks and months while retaining the original point indexes", () => {
  const labels = Array.from({ length: 120 }, (_, i) => new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10));
  const daily = revenueDateTicks(labels.slice(0, 7), { preset: "week", from: labels[0], to: labels[6] });
  expect(daily.title).toBe("Date");
  expect(daily.ticks).toHaveLength(7);
  expect(daily.ticks[0].label).toContain("Jan");
  const weekly = revenueDateTicks(labels.slice(0, 60));
  expect(weekly.title).toBe("Week");
  expect(weekly.ticks[1].label).toContain("Week of");
  const monthly = revenueDateTicks(labels, { preset: "year", from: labels[0], to: labels[119] });
  expect(monthly.title).toBe("Month / year");
  expect(monthly.ticks.map((t) => t.index)).toEqual([0, 31, 59, 90]);
  expect(monthly.ticks[0].label).toContain("2026");
  expect(labels).toHaveLength(120);
});
