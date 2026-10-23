# Individual Store Performance dashboard

Implemented 13 October 2026.

The four compact primary KPI cards appear in Week → Month → Year → Customers order. Revenue This Month uses the existing `report.summary.month` calendar calculation. KPI values and registered customer counts remain fixed when chart/table filters change. Transactions in Period appears alongside Recent Transactions and follows that table's period.

The global date form is removed. Revenue Over Time, Sales by Category, Product / Sales Performance, and Recent Transactions each have independent Today, This Week, This Month, This Year, and Custom Date Range filters with small period indicators. Presets run through today in Africa/Johannesburg. Legacy URL dates initialize the sections. Store information, managers, all table columns, and low-stock information remain available.

The store dashboard reuses the franchise overview's controls, validation, race protection, retry handling, styling, and bounded cache. Revenue filters use store-scoped aggregate totals without item reads. Category and table periods share exact-range cached detail responses and deduplicate concurrent matching requests; aggregate detail responses cannot be reused for a narrower period. Product items retain the authenticated, paginated batching fix. Every server action rechecks store ownership and derives franchise identity from authentication. No schema, RLS, or production data changes were made.

## Files changed

- `app/dashboard/franchise/sales/[storeId]/page.tsx`
- `app/dashboard/franchise/sales/actions.ts`
- `components/franchise/StoreSalesOverview.tsx` (new)
- `components/franchise/FranchiseSalesOverview.tsx`
- `lib/franchise/data.ts`
- `lib/franchise/overview-periods.ts`
- `scripts/test-franchise-overview-harness.mjs`
- `tests/local/franchise-overview.playwright.config.ts`
- `tests/local/store-sales-filters.spec.ts` (new)
- `tests/security/franchise-overview-loader.test.ts`
- `tests/unit/franchise-overview-periods.test.ts`
- This report.

## Verification

- 21 focused unit/security tests passed: calendar and cents calculations, snapshot reuse/deduplication/expiry, exact-range detail caching, store ownership, scoped aggregate arguments, and complete sales/item pagination.
- Both Playwright UI tests passed: franchise overview regression and individual store KPI order, independent chart/table filters, custom date labels, KPI stability, and responsive layout.
- Authenticated staging browser check passed: clicked View Store from the franchise overview, compared all four primary KPI values with authenticated store-scoped database totals, changed revenue/category/transaction periods independently, and verified KPI stability and overflow at 1440, 1024, 768, 390, and 320px.
- Focused ESLint and TypeScript checks passed.
- Staging production build passed.

The authenticated verification used existing staging records for read-only report checks and a temporary test session. No sales, products, customer records, or staffing assignments were modified. The temporary verification script was removed.
