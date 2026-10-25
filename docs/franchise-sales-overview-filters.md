# Franchise revenue reporting

The existing `/dashboard/franchise/sales` page now defaults to **Months** for the current South African calendar year. No production deployment, schema change, authentication change, or production data write was performed.

## Revenue filters and boundaries

- **Days:** choose a month and an available year. All 28, 29, 30 or 31 day labels appear. Each occurred day of the selected month has its actual completed-sale total, including R0 where appropriate. Future days are labelled Not started and have no fabricated revenue marker.
- **Weeks:** choose an available ISO week-year. At New Year the default and available weekly years follow the currently started ISO year, which can differ from the calendar year. Week 1 contains 4 January; every week runs Monday through Sunday. There are 52 or 53 labels, with precise cross-year ranges and an in-progress indicator in tooltips. This deliberately differs from calendar-year boundaries around New Year.
- **Months:** choose an available calendar year. January through December always appear, with actual monthly sums. Months before the first recorded sale have no recorded history. Future months have no revenue result.
- **Years:** show each calendar year from the authenticated franchise's earliest recorded sale through the current year. The list expands from sales history and the South African current date, without hardcoded years.

Every reporting slot has an X-axis label. Actual points retain circular markers, exact rand values and date/range tooltips. The internal SVG reserves readable space per slot and scrolls horizontally; the Revenue (R) axis and Day/Week/Month/Year title stay visible. Null values distinguish future periods and months outside reporting history from actual zero revenue. Occurred days and completed weeks without sales are zero-filled. Charts retain their 200px footprint and existing colours/fills.

## Expanded report

The expand button opens a native modal over the current page using the strain selection interface's dark blurred backdrop, rounded edges and green accents. The modal shares the inline report's selection, loaded data, pending state and retry logic. Changes in either view persist in both. Close and Escape dismiss it, keyboard focus stays inside while open, and closing restores focus to the expand button.

The enlarged plot fits the full selected period without horizontal scrolling. Axis labels are spaced to the available width; day and week labels use numbers and W prefixes, and months use abbreviations. All actual points remain available through hover, keyboard focus and the data table, with exact rand values in tooltips. Unavailable periods retain their null values. Inline charts keep their existing complete labels and scrolling behavior. Filters use consistent compact widths in both views. Overview-only back-button and heading margins are reduced, preserving KPI sizes and order.

## Revenue source and reconciliation

Historical reads reuse the existing `franchise_dashboard_totals` RPC. It derives South African daily buckets from `pos_sales.created_at`, sums the authoritative recorded sale total once per completed sale, and retains existing status and RLS rules. Daily rows are combined in integer cents into weekly, monthly and yearly periods. No sale-item join is introduced into the revenue calculation.

Recorded sales of any status establish reporting history; only completed sales contribute revenue. The earliest-sale lookup uses an inner stores join, an explicit authenticated franchise filter, an ascending timestamp order and limit 1. Both historical bounds and every aggregate read are authorized on the server. Multi-year ranges are limited to available sales history through today; legacy one-year range validation is otherwise preserved.

Sales by Store and Store Performance keep their independent filters. **Use revenue range** in Store Performance applies the currently displayed revenue report's exact bounds, including all available years. Sales by Store retains its independent date dropdown and custom date controls without the shortcut button. Their per-store totals reconcile with the sum of actual points for that same range. ISO weeks can cross calendar years, so use matched bounds when comparing them. View Store/Back links preserve the selected dates, and date preferences are restored within the browser session. Store-detail loaders support authorized multi-year ranges carried by these links.

KPI calculations, order, customer counts, table columns, bar paging, navigation and the dashboard design remain unchanged. The existing GreenChoice spinner appears during report fetching. Failures retain the last valid report and offer Retry; request sequencing prevents late replies from changing the selected result. A two-minute request timeout releases the spinner and permits another attempt. View-local range caching and in-flight deduplication remain in place.

## Changed files

- `lib/franchise/revenue-reporting.ts`: period definitions, history validation, aggregation and titles.
- `lib/franchise/data.ts`, `reporting.ts`, `overview-periods.ts`: history lookup, authorized historical ranges, shared date validation and compatible store totals.
- `app/dashboard/franchise/sales/actions.ts`, `page.tsx`, `[storeId]/page.tsx`: historical action and history metadata.
- `components/franchise/FranchiseRevenueReporting.tsx`: reporting selectors, state, loading and retry.
- `components/franchise/FranchiseSalesOverview.tsx`, `StoreSalesOverview.tsx`: integration, range matching and store-detail compatibility.
- `components/franchise/RevenuePlot.tsx`, `UI.tsx`, `Franchise.module.css`: all reporting labels, null-period rendering and tooltip bounds.
- `tests/unit/franchise-revenue-reporting.test.ts`, `tests/security/franchise-overview-loader.test.ts`, `tests/security/franchise-database.test.ts`, `tests/local/franchise-sales-filters.spec.ts`, `scripts/test-franchise-overview-harness.mjs`: regression coverage and isolated browser harness.

## Interface update files (15 October 2026)

- `components/franchise/FranchiseRevenueReporting.tsx`: expanded modal, shared controls/state, keyboard closing and focus restoration.
- `components/franchise/RevenuePlot.tsx`: full-period plot sizing, readable responsive ticks, hover targets and non-interactive axis marks.
- `components/franchise/ChartAxes.tsx`: optional plot height for aligned expanded axes/gridlines; existing defaults retained.
- `components/franchise/UI.tsx`: opt-in full-period chart rendering.
- `components/franchise/FranchiseSalesOverview.tsx`: remove Sales by Store range shortcut and clarify the help text.
- `components/franchise/FranchiseDashboardBack.tsx`: overview-only spacing class.
- `components/franchise/Franchise.module.css`: compact overview spacing, consistent filter widths and strain-style modal treatment.
- `tests/local/franchise-sales-filters.spec.ts`: independent custom-range regression and modal tests across four periods and four viewport sizes.
- `docs/franchise-sales-overview-filters.md`: behavior and verification notes.

## Verification

All 11 isolated browser tests pass, covering the four period selections, year/month changes including leap February, exact data parity between inline and expanded plots, rand axes and hover/focus tooltips, Close/Escape, focus containment/return, no modal horizontal scrolling at 1440/768/390/320px, preserved KPI order, store filtering, navigation, loading, retries and stale responses. Desktop and mobile screenshots were visually inspected. The harness uses existing isolated fixtures, with no database connection; this does not claim a live authenticated production browser test.

TypeScript and production build checks pass. Changed-file ESLint passes; full lint passes with an existing unrelated internal-navigation warning in `components/customer/CustomerCheckout.tsx`.

The unit/security/integration run with two workers and a 60-second timeout reports 478 passed and one unrelated failure: `tests/unit/customer-experience-ui.test.ts` expects `opacity-62 saturate-125`, while the current dashboard uses `opacity-34 saturate-125`. The unscoped `npm test` command also incorrectly collects four existing Playwright specs as Vitest suites and had two default-timeout failures; both timed-out tests passed in the scoped run. These unrelated files/configuration were left unchanged.

Commands:

```text
npm run lint
npm run typecheck
npm run build:local
npm run test
npx vitest run tests/unit tests/security tests/integration --maxWorkers=2 --testTimeout=60000
npx playwright test --config tests/local/franchise-overview.playwright.config.ts
```
