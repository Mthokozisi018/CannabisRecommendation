# Franchise Administrator implementation

Implemented in the existing GreenChoice Next.js application, preserving its existing uncommitted work. The supplied ZIP contained five reference images, so the user confirmed this local project as the implementation target. The screens use the supplied dashboard, directory, analytics and storefront references with real database data.

## Behaviour and routes

| Route | Behaviour |
| --- | --- |
| `/dashboard/admin/franchises` | Platform Admin franchise directory, including incomplete registrations that can be resumed. |
| `/dashboard/admin/franchises/new` | Two stages: franchise information, then its Franchise Administrator account. |
| `/franchise/setup` | Forced permanent-password change and legal acceptance before FA access. |
| `/dashboard/franchise` | Authenticated welcome, franchise identity, sales today, recorded manager logins today, and exactly three main navigation cards. No sidebar. |
| `/dashboard/franchise/stores/new` | Register a store; franchise assignment comes from the authenticated profile. |
| `/dashboard/franchise/stores` | Franchise-only store grid; search store name, managers and location. |
| `/dashboard/franchise/stores/[storeId]` | Store Manager, Staff Management and Store Settings tabs for the selected store. |
| `/dashboard/franchise/sales` | Franchise KPIs, selected-period revenue chart, revenue by store and store performance table. |
| `/dashboard/franchise/sales/[storeId]` | Separate store analytics: revenue, dynamic sale categories, product performance, recent transactions and low stock. |

The Admin dashboard now links to Franchises. Existing sign-in endpoints recognize `franchise_admin` and route incomplete accounts to setup. Passwords use the existing strong-password policy and manual temporary-credential handover convention. Temporary credentials are never included in audit records or returned by actions. Successful setup changes the Auth password before marking the profile complete.

Store Settings starts read-only. Edit exposes validated contact/address/status fields, opening hours and photo upload; Cancel restores read-only display. Managers and receptionists have searchable/filterable directories and actions for editing names/phone, restricting, reactivating, deactivating and requesting password reset. Removing a manager releases the assignment, deactivates access and retains business history. New staff accounts enter the existing Manager or Receptionist onboarding flow.

## Database, authorization and isolation

Migration: `supabase/migrations/20261010085411_franchise_administration.sql`.

- Adds `franchises`, nullable `stores.franchise_id`, `staff_profiles.franchise_id` and `assigned_at`, with foreign keys, role/assignment constraints and relevant indexes. Existing independent stores remain valid.
- Each FA has one stored franchise assignment and no store assignment. Registration serializes against the franchise row to prevent duplicate active FA assignments.
- Route and data helpers verify authenticated role, active account, completed setup and stored assignment. Store access additionally checks the requested store belongs to that franchise.
- Reads use the authenticated Supabase client. Scoped SELECT policies and restrictive boundary policies prevent existing broader catalog policies from widening FA access to other franchises.
- Incomplete or inactive FA accounts cannot use direct database reads to bypass onboarding or restrictions. The profile itself remains readable for authentication/setup.
- Writes use a service-only `franchise_mutation` RPC. Its private transaction function rechecks the verified actor, current role, setup and store ownership under locks. Neither browser role can execute the mutation function or wrapper.
- Auth-account binding checks trusted `app_metadata` written by the server. Browser-supplied actor/franchise identifiers do not establish authority.
- A database trigger applies staffing capacity to every writer, including existing Admin/Manager paths and independent stores. Shared transaction advisory locks and store row locks protect simultaneous requests.
- Maximum three assigned, non-deleted managers. Deactivating a manager keeps the assignment until explicitly removed. Maximum five active/restricted receptionists, consistent with existing receptionist allocation rules; reactivation rechecks capacity.
- Sensitive staff/account operations require the acting user's current password. Origin checks, validation and rate limits run on server actions.
- Legacy store memberships are removed when staff access is restricted/deactivated or a manager assignment is removed.

The migration was applied only to isolated **GreenChoice Staging** (`jezbvjepxosphdrykrcg`). Production (`nfrvbnthsmlyqzmvqylh`) was not changed. The local migration timestamp matches the applied staging migration. No application deployment was performed.

## Reporting and storage

Revenue uses completed `pos_sales` records and existing South Africa calendar helpers. Monetary sums aggregate cents before converting to rand. Calendar week/month/year KPIs remain calendar-based; charts and performance tables use the selected inclusive date range, limited to one year. Dates without sales display zero rather than fabricated transactions. Queries paginate database results instead of relying on Supabase's default row limit.

Total Customers counts registered, non-deleted POS customer records per store. The franchise figure sums those store records; it does not claim to deduplicate the same person across stores. Category and product analytics use recorded sale-item snapshots, preserving historical sales classifications. Recent transactions reuse the existing Manager report mapping and payment methods. Low stock shares the existing Manager inventory rule through `lib/manager/stock-level.ts`.

The supplied storefront is stored once at `public/images/franchise/store-default.png`; stores without a custom photo use that URL. Uploads reuse existing image decoding/validation, normalize to WebP and use generated paths in the existing `store-images` bucket. A restrictive storage policy blocks authenticated browser writes to that bucket; authorized server actions write after checking ownership. Failed database attachment cleans up the newly uploaded object. Existing public image delivery is retained.

## Audit

Franchise creation, FA creation/setup, store changes and staff actions record structured `franchise_*` events in the same transaction as the database mutation. Successful sign-ins now include the trusted client IP when available and a bounded user-agent value in the existing login audit.

Manager Login History displays actual successful login events from the latest 100 selected-store login records. Older records without IP/browser information say “Not recorded”. Failed sign-ins are not attributed to a manager or fabricated. Staff “Latest Recorded Login” is explicitly limited to that recent history window.

## Files created

- `app/dashboard/admin/franchises/{page.tsx,actions.ts,new/page.tsx}`
- `app/franchise/setup/{page.tsx,actions.ts}`
- `app/dashboard/franchise/{layout.tsx,page.tsx,actions.ts,loading.tsx,error.tsx}`
- `app/dashboard/franchise/stores/{page.tsx,new/page.tsx,[storeId]/page.tsx}`
- `app/dashboard/franchise/sales/{page.tsx,[storeId]/page.tsx}`
- `components/franchise/{Franchise.module.css,UI.tsx,Forms.tsx,StoreDirectory.tsx,StoreManagement.tsx}`
- `lib/franchise/{types.ts,auth.ts,validation.ts,mutations.ts,reporting.ts,data.ts}`
- `lib/manager/stock-level.ts`
- `public/images/franchise/store-default.png`
- `supabase/migrations/20261010085411_franchise_administration.sql`
- `tests/security/{franchise-database.test.ts,franchise-actions.test.ts}`
- `tests/unit/franchise-reporting.test.ts`
- `tests/e2e/franchise-administration.spec.ts`
- This implementation report.

## Existing files modified for this feature

- `lib/{types.ts,authorization.ts,account-flow.ts,staff-profile.ts,dashboard-session.ts}`: distinct FA role, stored franchise assignment and setup-aware authorization/routing.
- `app/api/auth/{login/route.ts,login-form/route.ts,access-decision/route.ts}`: FA login destination; successful login IP/browser audit details in login handlers.
- `components/TopBar.tsx`: FA routes use their dedicated header.
- `components/admin/AdminDashboardUI.tsx`: Franchises navigation entry.
- `lib/manager/data.ts`: reuse extracted stock-level classification without changing its thresholds.
- `lib/staff-password-reset.ts`: propagate reset-email errors instead of reporting false success.

These are feature changes only; the repository already contained many unrelated modifications.

## Server actions

No new public API endpoints are required. New server actions are:

- `registerFranchiseAction`, `registerFranchiseAdminAction`.
- `completeFranchiseSetupAction`.
- `saveFranchiseStoreAction`, `uploadFranchiseStoreImageAction`.
- `createFranchiseStaffAction`, `manageFranchiseStaffAction`.

## Verification

- `npm run build:local`: production build passed against the isolated staging configuration, including compilation, TypeScript and page generation.
- `npm run typecheck`: passed.
- `npm run lint`: zero errors; one existing warning in `components/customer/CustomerCheckout.tsx:86` about `window.location.assign()`.
- `npm test -- --maxWorkers=2`: **420 passed, one existing failure** across 70 files. `tests/unit/customer-experience-ui.test.ts:74` searches `GreenChoiceDashboard.tsx` for wallpaper classes now located in its re-exported `DashboardBackdrop.tsx`. Neither implementation file was changed for FA. The assertion was not weakened or hidden.
- All 18 new unit/security tests passed: seven database migration/security tests, seven server-action boundary tests and four reporting/role tests. The database tests execute the actual migration in PGlite and exercise isolation, role/setup gates, staff caps, atomic auditing and independent-store compatibility.
- `npm run validate:migrations`: 67 forward migrations passed.
- `npm run scan:secrets`: passed.
- `npm run audit:production`: zero vulnerabilities.
- Staging privilege inspection confirmed browser roles cannot execute FA mutations; private read predicates have only the permissions required by RLS.
- Supabase security advisor reported no new FA findings. Existing findings remain: legacy browser-executable SECURITY DEFINER functions, internal RLS tables without policies and disabled leaked-password protection. They were not silently changed as part of this feature.

The staging browser test is explicitly opt-in and uses generated accounts/franchises/stores, removing its own data and uploaded images afterward. Run it with PowerShell:

```powershell
$env:GREENCHOICE_FA_E2E='true'
node scripts/run-with-local-env.mjs node_modules/@playwright/test/cli.js test tests/e2e/franchise-administration.spec.ts --workers=1 --reporter=line
```

The final staging Playwright run **passed** (one complete scenario, approximately 1.1 minutes). It verified temporary-password replacement and dashboard setup gating, exactly three navigation cards, browser RPC denial, cross-franchise database/URL denial, Admin route denial, anonymous redirects, store creation and editing, read-only Settings, photo upload, search, concurrent manager/receptionist limits, and staff restriction/reactivation. It inserted R250 of sales into the selected franchise and R99,999 into the other franchise, checked that only R250 was reported, and verified actual category, transaction and low-stock rows. Layout checks passed at 1280, 1024, 768 and 390 pixels without page overflow.

Browser verification found and resolved a staff form-reset mismatch and wide-table grid overflow. The latest 18 focused unit/security tests also passed after those fixes. Read-only staging inspection confirmed zero remaining verification franchises, stores or Auth accounts; uploaded test photos were removed in cleanup.

Local visual evidence (temporary test data, not permanent demo accounts):

- [FA dashboard](../test-results/franchise-administration-f-402d3--concurrent-staffing-limits/fa-dashboard-desktop.png)
- [Store management](../test-results/franchise-administration-f-402d3--concurrent-staffing-limits/fa-management-desktop.png)
- [Populated store analytics, desktop](../test-results/franchise-administration-f-402d3--concurrent-staffing-limits/fa-analytics-desktop.png)
- [Populated store analytics, mobile](../test-results/franchise-administration-f-402d3--concurrent-staffing-limits/fa-analytics-mobile.png)

The in-app browser tool was unavailable due to a missing sandbox-policy error, so verification used the repository's Playwright runner. Its test-result directory is local and may be replaced by later test runs.

## Operational notes

- Production rollout still requires applying the forward migration and deploying this application together. The feature has been built locally and migrated/tested on staging only.
- Use the existing authenticated Platform Admin account to register real franchises and FAs. No permanent demo staff, password or franchise is supplied.
- Existing Supabase Auth email delivery and reset redirect configuration are reused. End-to-end receipt of reset emails requires a real controlled mailbox; automated verification does not send reset messages to fixture addresses.
- Manager assignment currently creates a new account. Moving an existing staff account between stores remains a platform administration operation; the FA form explains this instead of silently taking over an existing identity.
- Historical assignment dates and login device/IP fields cannot be reconstructed safely; missing values are identified in the UI.
- Customer/manager/receptionist workflows retain their existing route and authorization paths. Existing security findings and the unrelated wallpaper assertion are listed above for follow-up.
