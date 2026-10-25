# Franchise dashboard sizing and performance

Completed 13 October 2026. Implementation and database verification used GreenChoice **staging**, not production. Existing working-tree changes were retained.

## Result

The authenticated sales data pipeline became **84.4% faster** in the measured fixture: median **25.969 s → 4.039 s**. Database requests fell **17 → 4** and response bodies **1,270,279 → 61,361 bytes** (95.2% smaller). This is a server data-loading measurement, not a before/after browser page-load measurement.

Final production-build browser measurements against staging:

| View | Loading/content visible | Data visible |
|---|---:|---:|
| Main FA dashboard, three visits | 112–184 ms | 998–1,056 ms |
| Sales overview, cold aggregate cache | 164 ms | 5,150 ms |
| Sales overview, two immediate revisits | 163–279 ms | 1,056–1,158 ms |

The homepage and repeat-navigation targets were met in this sample. **Cold overview data still exceeds the requested 2–3 second target.** The main remaining cost is existing per-row RLS evaluation; policies were preserved.

## Compact UI

- Shared franchise styling covers the main dashboard, overview, directory, store performance and management, all three management tabs, and add-store/setup forms.
- Navigation card minimum height: 310 → 116 px desktop; 230 → 76 px mobile. Rendered desktop cards can be taller to fit their labels.
- Exactly three main navigation links, in the requested order: **View Franchise Sales Performance**, **Add a Store to the Franchise**, **Manage Stores**. Destinations and existing navigation flow are retained. No sidebar was added.
- Standard buttons/inputs have 36 px minimum height; panel padding is generally 16 px, with smaller mobile spacing.
- Page headings now scale from 22–28 px; welcome names from 26–38 px. KPI values generally scale from 18–24 px.
- Charts are 200 px high instead of 260 px. Tables use 8 × 10 px cell padding and retain local horizontal scrolling on narrow screens. Bar values stay on one line with horizontal scrolling when necessary.
- Green/black colors, existing store imagery, icons, and backgrounds remain. Focus outlines remain visible.
- The franchise wallpaper is the same image encoded as WebP: **1,866,629 → 120,438 bytes**, 93.5% smaller. Original dimensions are retained. Other dashboards retain their original asset.

## Causes and fixes

**Sequential pagination and overfetching.** The old overview read 3,749 sale rows in eight sequential 500-row requests to calculate yearly/current calendar KPIs and selected-period totals. Its UUID ordering also required filtering/sorting the qualifying rows repeatedly. It waited for the directory, then sales, then customer counts. It constructed transaction detail objects even on the franchise overview, which never displays them.

**N+1 customer requests.** Six separate store customer-count requests were issued in the measured franchise.

**RLS overhead.** Existing indexes were present, including `pos_sales_store_completed_date_idx`, `stores_franchise_idx`, customer partial indexes, and the login-history index. A privileged first-page sales query took 3.137 ms, but its authenticated equivalent took **3,262.638 ms**. The authenticated grouped-sales plan took **3,321.024 ms**, and the complete totals RPC took **4,087.537 ms**. Plans show repeated `private.fa_owns_store` and `is_store_member` checks. Privileged timings alone would have missed this bottleneck.

Changes:

1. `franchise_dashboard_totals` aggregates completed revenue and transaction counts by South African day/store and customer counts by store in one response. It uses `SECURITY INVOKER`, explicit authenticated franchise/store checks, fixed search path, and authenticated-only execution grants. Existing table RLS policies and indexes were not changed. The JSON result avoids REST row-limit truncation of aggregate buckets.
2. Directory, totals, recent transactions, sale items and login reads start concurrently where independent. Request-scoped React caching deduplicates authorization/store checks and directory reads.
3. Homepage reads only franchise identity and managers, rather than downloading the store directory and receptionists. Login reads select only needed fields and filter manager logins for the local calendar day.
4. Store performance scopes the directory to that store and reads only the newest **20** selected-period transactions. Complete totals still use every qualifying sale. Category/product totals continue to use all selected-period items.
5. A bounded **15-second**, instance-local aggregate cache deduplicates in-flight loads. Keys include authenticated user, franchise, store, selected dates, calendar day and customer mode. Authorization runs before every lookup. Errors are not cached and expired data is not served on failure. At most 32 entries are retained; large reports bypass retention. Successful mutations invalidate the actor's entries. Other instances naturally refresh on expiry.
6. Homepage summary streams behind a static skeleton while navigation renders independently. Sales routes have chart/KPI/table skeletons. Existing retry/error states remain, and the error-page dashboard link uses client navigation.
7. Period filtering uses Next `Form`, retaining client navigation. Currency/date formatters are reused. Charts already use SVG/CSS and server rendering, so no chart dependency or speculative memoization/lazy-loading library was added.

## Measurements and reproducibility

The comparable authenticated benchmark used isolated staging fixtures: six stores, 3,749 completed sales with the demo's dates/totals, matching store customer counts, and a synthetic FA with normal authenticated REST/RLS access. Both paths ran three times from the same workstation/session using the same date bounds and fetch instrumentation. No existing account credentials were requested or changed. Synthetic customer records contain no source customer personal information.

| Authenticated data path | Before range / median | After uncached range / median |
|---|---:|---:|
| Sales overview | 25.909–27.242 s / 25.969 s | 3.954–4.148 s / 4.039 s |
| Requests | 17 | 4 |
| Body bytes | 1,270,279 | 61,361 |

Median API responses: original sale pages **3,216 ms** each; separate customer counts **785 ms**; new complete aggregate RPC **4,023 ms**. The RPC replaces many calls, so its single-request duration should not be compared to one original page as if they performed the same work.

The first privileged/server-credential baseline measured homepage data at 567–2,812 ms and sales data at 5,107–6,860 ms. It excluded RLS and therefore understated normal FA loading. Its raw results are retained for transparency.

The initial authenticated five-request homepage prototype measured median 578 ms before and 545 ms after. The final homepage has four cold requests; its final browser timings above include authentication/server rendering. Those prototype API numbers are not claimed as measurements of the final four-request homepage.

Artifacts:

- `franchise-performance-before.json`: initial privileged baseline, request-level timings/statuses/body sizes.
- `franchise-performance-authenticated.json`: authenticated before/after pipeline and earlier development browser timings, before the short-lived cache.
- `franchise-performance-browser-final.json`: final production-build browser timings with the cache.
- `scripts/benchmark-franchise.ts`: read-only original staging query benchmark.
- `scripts/benchmark-franchise-authenticated.ts`: explicitly opted-in staging fixture comparison and browser verification. Set `GREENCHOICE_FA_BENCHMARK=true`; browser-only replay also uses `GREENCHOICE_FA_BENCHMARK_BROWSER_ONLY=true`. Run through the staging environment runner with a staging-connected server on port 3001.

Production-mode local testing required a **process-only** loopback entry in `ALLOWED_ORIGINS`; environment files and deployed security settings were not changed. All generated fixtures were removed. Cleanup verification found zero temporary benchmark/verification franchises or benchmark auth users; the source franchise still has 3,749 sales and R1,576,775 revenue.

Limitations: three repetitions are a small sample, not a load test or percentile/SLA. Network, server region, connection reuse and local hardware affect results. The data-pipeline comparison excludes dashboard session resolution and React calculation. No original production-build browser snapshot was available, so no before/after browser speedup is claimed. Loading visibility measures a displayed skeleton/navigation/heading, not completion of useful financial data. Cached revisits used the same process within the TTL; a new serverless instance misses the cache. Largest-resource investigation identified the wallpaper; a complete before/after frontend bundle waterfall was not captured.

## Verification

- Production build, TypeScript check, focused ESLint and all 70 migration filename checks passed.
- **24 focused tests passed**: reporting, SQL/RLS boundaries, server-action authorization, cache expiry/deduplication/isolation/capacity/error retry/mutation invalidation.
- Staging franchise E2E passed: onboarding/password replacement, exact navigation count, store create/edit/photo upload, manager/receptionist capacity, staff restriction/reactivation, sale/item/category totals, low stock, cross-franchise denial and unauthenticated/admin-route denial.
- Browser verification passed at **1440, 1280, 1024, 768, 390 and 320 px** across six views and all management tabs. No document-level horizontal overflow occurred. Date filtering issued zero document-navigation requests; the full-range table reconciled to 3,749 transactions. SQL totals reconciled to **R1,576,775**.
- Desktop and mobile screenshots were inspected. A final sizing adjustment prevents wrapping of chart currency labels.
- Final full suite: **446 passed, 1 failed** (447 tests). Results are recorded in `.codex-fa-compact-tests-final.log`. The existing customer-wallpaper assertion in `tests/unit/customer-experience-ui.test.ts` also failed in the pre-task `.codex-independent-tests.log`; unrelated customer code was retained.
- Supabase's security advisor raised no finding against the new invoker function. Existing project findings include authenticated definer functions, service-only RLS tables without user policies, and disabled leaked-password protection; these were outside this change.

## Remaining work and release

Cold overview latency is still about 5.15 seconds in the final browser sample. Further reduction needs a separately reviewed optimisation of existing RLS helpers/policies or a different secured reporting strategy. Store category/product reports still paginate full selected-period sale items; very large periods may remain expensive. Directories still read all matching stores for the existing client search experience. Neither was silently truncated.

The function migration was applied **only to staging**. Apply `20261013060837_franchise_dashboard_aggregates.sql` to the target database **before** deploying the updated frontend; the DAL requires that RPC. Production data and deployments were untouched.

## Files changed for this task

- `app/dashboard/franchise/page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `sales/loading.tsx`, `sales/[storeId]/page.tsx`
- `components/franchise/Franchise.module.css`, `UI.tsx`, `Loading.tsx`
- `lib/franchise/auth.ts`, `data.ts`, `reporting.ts`, `mutations.ts`, `totals-cache.ts`
- `public/images/franchise/dashboard-wallpaper.webp`
- `supabase/migrations/20261013060837_franchise_dashboard_aggregates.sql`
- `tests/unit/franchise-reporting.test.ts`, `franchise-totals-cache.test.ts`, `tests/security/franchise-database.test.ts`, `tests/e2e/franchise-administration.spec.ts`
- The two benchmark scripts and the performance JSON/report artifacts listed above.

Implementation references: [Supabase database functions](https://supabase.com/docs/guides/database/functions), [Supabase RPC API](https://supabase.com/docs/reference/javascript/rpc). Next.js Form/loading behavior was checked in the installed Next 16.3.8 documentation.
