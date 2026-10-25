# Supply History redesign

Supplier Information now opens on the current Johannesburg calendar month with
one row per recorded supply transaction. Month, Week, Recorded By, Category,
Supplier and Search select records directly; only an individual transaction
expands. This replaces the former Month → Supplier → Supplies browsing hierarchy.
Supplier registration and the existing Supplier Details, Products Supplied,
Stock History and Supplier Information modal contents remain available unchanged.

| File | Change |
| --- | --- |
| `app/dashboard/manager/suppliers/page.tsx` | Load the initial current-month report rather than all supply history. |
| `app/dashboard/manager/suppliers/actions.ts` | Add authenticated, origin-checked, rate-limited report refresh and supplier-profile reads. Existing mutation bodies remain unchanged. |
| `components/manager/SupplierManagement.tsx` | Keep the existing page header and supplier editor/detail dialogs; replace the nested browsing rows with the new report and load profiles on demand. |
| `components/manager/SupplyHistoryOverview.tsx` | New filter bar, compact filtered summary, transaction rows, product breakdowns, empty/loading/error states and pagination. |
| `components/manager/SupplyHistoryOverview.module.css` | Short detail-reveal animation with reduced-motion support. |
| `lib/manager/supply-report.ts` | New authenticated, store-scoped, month-bounded database loader with batched reads. |
| `lib/manager/supply-report-model.ts` | New filter validation, ID-based transaction assembly, complete-transaction filtering, summary and page calculations. |
| `lib/manager/report-calendar.ts` | Shared Johannesburg date/month/week utilities extracted from Sales Overview without changing their calculations. |
| `lib/manager/sales-overview.ts` | Import/re-export the extracted calendar utilities; existing reporting, pricing, export and UI behavior are preserved. |
| `lib/manager/suppliers.ts` | Optionally scope the existing profile loader to one supplier and its delivery IDs. |
| `lib/manager/supply-history.ts` | Remove obsolete main-table month/supplier aggregation; retain the existing profile history utilities. |
| `tests/fixtures/supply-report.ts` | Synthetic delivery, product-line and recording-staff fixtures; no database inserts. |
| `tests/unit/supplier-table-history.test.tsx` | Replace obsolete hierarchy tests with transaction, filter, calendar, totals, historical-cost and empty-state tests. |
| `tests/unit/supply-report-loader.test.ts` | Verify authorization, explicit store predicates, recording-time bounds, bounded batches, all-result totals and fail-closed reads. |
| `tests/local/supplier-history-browser.mjs` | Exercise the actual new UI/report model with synthetic read responses at desktop, laptop, tablet and mobile widths. Writes are blocked. |

Sales Overview provides `groupedTableStyles` for controls, filter/table surfaces,
headers, transaction buttons, detail panels and product tables. The new page uses
the same native month input, Monday–Sunday calendar week convention (including
partial and six-week months), 350ms search debounce, 10-transaction result pages
and single expanded-row interaction. The calendar implementation is shared rather
than independently recreated. The Sales Overview UI itself was not modified.

The report uses the authenticated Supabase client, keeping existing RLS in effect.
Every database read explicitly uses the manager's assigned store. Detailed
delivery reads use `created_at` bounds for the selected month. Item reads use the
actual delivery IDs and the same store. Queries page through 200-record batches
to avoid the API response cap. Only the selected result page and its product lines
are sent to the browser; summaries cover the entire filtered month/result set.
Supplier and recorder filter metadata are lightweight store-scoped reads.
Recorder metadata scans only the recorded-by field across historical deliveries,
so inactive/historical recorders remain selectable without sending historical
transactions to the browser.

Filters use supplier and recording-user IDs. Search matches supplier name,
product snapshot, reference and recording-staff name, case-insensitively.
Selecting a month resets Week to All month and resets pagination. Other filter
changes and debounced search also reset pagination; ordinary pagination retains
the chosen month and all other filters. A server refresh after supplier changes
reloads the report using its current filters. New page loads derive the default
month from the server's current Johannesburg date.

Delivery IDs group the line items; names or dates never create associations.
Separate deliveries recorded on the same day remain separate. The displayed
recording timestamp comes from `created_at`; the delivery date from `received_at`
appears separately in details. Product quantities, unit costs and line totals use
their historical snapshots. Full transaction totals use stored `total_cost`.
Matching one category includes the entire transaction, all categories/products
and its full cost. Discrepancies between historical line costs and the recorded
total are shown for reconciliation without overwriting records. Quantities are
summed separately for units and grams in transaction details. The Products
Received KPI counts distinct `product_id` values across the full filtered
transaction set, including all result pages, with repeated products counted once.
Its description is “Total unique products received.” Quantity and cost totals
retain their existing calculations.

Six readable filters wrap into two rows on wide screens and smaller grids on
tablets. Desktop rows retain aligned columns and vertical dividers. Below desktop
width, transactions become labelled cards and product breakdowns scroll inside
their own container. New surfaces are solid GreenChoice colours. Compact summary
cards use the established green, blue, amber and purple palette.

Validation includes report-model/loader tests, Sales Overview reporting/security
regressions, the complete unit/integration/security suite and browser verification
at 1440, 1024, 768 and 390px. Browser scenarios cover current-month defaults,
month/week changes, recording-user ID isolation, mixed-category full totals,
combined filters, search debounce, empty states, supplier profile/registration
access, expansion, pagination and absence of viewport overflow/runtime errors.
Generated screenshots and the browser result report are in
`tmp/supplier-history-verification/`.

Final results: 402 tests across 67 files passed with
`npm run test -- --maxWorkers=1`. The browser harness passed at all four widths
and its pagination scenario. `npm run build:local` and the TypeScript check passed.
Lint reported zero errors and one pre-existing warning in CustomerCheckout.
An existing checkout test's import timed out during concurrent validation;
the complete suite passed when rerun without that resource contention.

No schema migration is required, and no production migration or historical-data
mutation was performed. Two existing-schema limitations remain: deleting an Auth
user sets `recorded_by` to null, so the original identity cannot be recovered
without a historical name snapshot; such records are labelled honestly. Delivery
notes/invoice fields do not exist in the inspected schema, so they are not queried
or invented. For very large stores, a reviewed index on
`supply_deliveries(store_id, created_at DESC, id)` would improve recording-time
report scans; it has not been added or deployed. Live-store verification remains
separate from the synthetic browser and mocked database-loader checks.
