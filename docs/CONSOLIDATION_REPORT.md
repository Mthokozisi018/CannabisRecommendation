# GreenChoice consolidation report

Date: 6 October 2026 (Africa/Johannesburg).

## Projects and Git

- Canonical: `C:\Users\MthokozisiP\booking_system\greenchoice-workstation`.
- Production Hardening found: `C:\Users\MthokozisiP\booking_system\greenchoice-production-hardening`.
- Canonical branch: `feat/customer-store-info-source-of-truth`. HEAD remains `5827ae1` (Restore local customer ordering and pending orders).
- Hardening branch: `staging`. HEAD was `69ee42b` (store-scoped supplier management).
- Existing remote: https://github.com/Mthokozisi018/CannabisRecommendation.git.
- Existing Vercel link remains `greenchoice-workstation`; the hardening folder's link was to `greenchoice-staging` and was not copied.
- Both requested folders were independent Git repositories. `greenchoice-release-20260903` was a worktree of canonical Git; `greenchoice-release-readiness` was another older checkout. No repository was initialized, history rewritten, commit created, or push/deployment performed.

## Discovered hardening and merge decisions

The dedicated release-hardening commits introduced verified Supabase request-boundary sessions, stale-cookie cleanup preserving PKCE, bounded Auth/database/cache requests, safe unavailable responses, protected readiness diagnostics, environment identity enforcement, authentic audit records, database function/search-path/RLS protections, and CI release gates. Security headers, CSP, existing server-side roles/store scoping, image validation, logging redaction, and rate limiting already existed in canonical source and were retained.

Differences were reviewed against source and Git history, not modification dates. The newer Workstation source was the baseline. Its current manager/receptionist dashboards, POS, Add Stock, Product Preview, inventory, supplier metadata/edit/history, staff accounts, customer registration/QR/storefront, navigation/addresses/alerts/orders, sales/PDF exports, payment methods, authentication, and store isolation remain. Baseline source files are present except seven migrations reconciled to their recorded production filenames.

Same-file changes were integrated as reviewed hunks. Customer redirects still use `/customer/shop`. POS still uses the newer service-only `complete_receptionist_sale_v3`; the hardening copy's incompatible six-argument v2 implementation was excluded. Supplier-backed creation/receipts were integrated into the newer Add Stock action. Canonical image normalization and optional image-error handling were retained. Original `.env.local` bytes match the verified before archive.

The single required secret-file migration was the already-used staging configuration: it now lives in ignored `.env.staging.local` inside Workstation. No production secrets or hardening `.env.local` OIDC values were copied. All runtime/test references to the hardening folder were removed. Local development now uses port 3001.

Production migration names were reconciled to recorded production history; newer POS, supplier, search-outbox, store-setting, and customer-address migrations were retained. An additional forward migration preserves the canonical test-account index and revokes the obsolete three-argument checkout without editing applied history. No remote migration was applied.

No Git merge conflict was created because no wholesale branch merge was performed. Conflicting application/auth/payment/migration changes were resolved selectively as above. An encoding error in a test assertion was repaired before final validation.

## Dependencies and configuration

- Next.js and eslint-config-next: 16.2.12 -> 16.3.8. The hardening copy's 16.3.5 had a critical advisory; npm audit identified 16.3.8 as the compatible patched version.
- sharp and its override: 0.35.3 -> 0.35.4.
- Added the hardening browserslist override 4.28.8.
- Updated vulnerable transitive packages through compatible npm audit fixes; retained the newer Elasticsearch dependency. No force or major toolchain migration was used.
- No additional direct security library was required. Unused Testing Library was excluded. npm remains the package manager (Node 24.14.0, npm 11.9.0); package-lock.json was regenerated.
- `READINESS_DIAGNOSTIC_SECRET`: now enforced at production startup; protects the Bearer-authenticated readiness endpoint; minimum 32 characters. It was already documented and exists in migrated staging configuration.
- `GREENCHOICE_CACHE_REDIS_TIMEOUT_MS`: new optional cache request timeout; 750 ms default, clamped to 100-2000 ms.
- Existing identity/origin/signing/Redis/Supabase names remain required. See `.env.staging.example`, `.env.production.example`, and `docs/staging-environment.md`. No secret values are included in this report.

### Direct dependency resolutions changed in package-lock.json

- `next`: 16.2.12 -> 16.3.8
- `sharp`: 0.35.3 -> 0.35.4

## Active hardening checklist

| Protection | Location | Verified / required configuration |
| --- | --- | --- |
| Nonce CSP, framing/MIME/referrer/permissions protections | `proxy.ts`, `next.config.ts` | Live development and production responses checked. Production has strict-dynamic and no unsafe-eval. Location allowed only for self to preserve Nearby Stores. |
| HSTS and private no-store responses | `proxy.ts`, `next.config.ts` | Verified in a production-mode process. Next dev uses its own no-cache response policy. HTTPS required in deployment. |
| Verified sessions and refresh, expired cookie cleanup, outage fail-closed behavior | `lib/supabase/proxy.ts`, `proxy.ts`, `lib/supabase/session-cookies.ts` | Connected to protected routes; behavior tests reject forged cookies and preserve cookies during outages. |
| Secure/SameSite cookies | Supabase server/browser/proxy clients and `lib/session.ts` | Production response cookie verified Secure + SameSite=Lax. Application state cookies remain HttpOnly; Supabase SSR browser session cookies remain JS-readable as required by its browser client. |
| Server-side roles and store authorization | `lib/dashboard-session.ts`, `lib/dal/auth.ts`, manager/customer/receptionist DAL/actions | Live role denials and authenticated routes checked; existing store-security tests pass. |
| Supplier receipt enforcement | `app/dashboard/manager/actions.ts`, supplier migrations | Positive stock uses supplier-backed atomic RPCs. Removing UI workflow flag cannot bypass validation. |
| Bounded dependency requests and safe errors | `lib/supabase/fetch.ts`, `lib/auth-errors.ts`, Auth routes, dashboard error boundaries, `lib/cache/redis.ts` | Connected to callers and tested. Cache is noncritical; Supabase remains authoritative. |
| Readiness diagnostics | `app/api/health/readiness/route.ts`, `lib/environment.ts` | Unauthenticated 401; correct secret + reachable staging database 200; minimal payload and private no-store. |
| Login throttling and existing action/API rate limits | login JSON/form routes, `lib/rate-limit.ts`, `lib/security.ts` | Both login entry points share IP throttling. Login fails closed in production when protection is unavailable. |
| CSRF/origin protection | `lib/security.ts` and mutation routes/actions | Exact configured-origin checks plus SameSite cookies and Next Server Action origin validation. No permissive cross-origin header added. |
| Server-only secrets and safe logs | `lib/supabase/server.ts`, `lib/logger.ts`, `lib/receptionist/customers.ts` | Secret scan passes; service key module has server-only boundary; provider error objects no longer logged by customer search. |
| Environment separation | `lib/environment.ts`, local/staging validators, `instrumentation.ts` | Staging differs from production; Vercel identities enforced; HTTPS and secrets/Redis required at production runtime. |
| Audit authenticity | `app/account/audit/page.tsx`, `lib/account-data.ts` | Uses permission-checked RLS-backed audit records; fabricated audit rows and backup dates removed. Live audit writes remain connected through `lib/logger.ts` and `lib/dashboard-session.ts`; the corrected legacy audit UI remains retired behind the existing /account redirect. |
| SQL/RLS/function security | release/supplier hardening migrations and `20261006072152_consolidated_security_followup.sql` | Source validated; application RPC callers integrated. Verify/apply pending migrations separately in each deployment target before release. |
| CI and deployment exclusion | `.github/workflows/production-gates.yml`, `.vercelignore` | Preserves lint/types/tests/audit/build; adds conflict check and unauthenticated browser tests; excludes local secret files from Vercel uploads. |

## Validation

- Type check: PASS (`npm run typecheck`); production build also runs TypeScript.
- Lint: PASS, zero errors; one existing Next.js navigation warning in `components/customer/CustomerCheckout.tsx:86`.
- Production build: PASS (`npm run build:staging`, actual optimized Next.js build, verified isolated HTTPS staging environment).
- Unit/integration/security tests: 314 passed, zero failed/skipped (`npm run test -- --maxWorkers=2`).
- Existing E2E: 3 passed; 5 tests skipped because their dedicated E2E credentials were not configured. Onboarding/password-changing tests were not exercised.
- Additional authenticated smoke: 28 checks passed across manager inventory/Add Stock/suppliers/staff/sales/orders/store, receptionist POS/products, customer Shop/Cart/Orders/Addresses/Alerts/Profile, protected readiness, and role denials. Existing alias redirects were verified. Staging test sessions were generated without sending email; no business sales, stock, supplier, account-creation, or order mutations were submitted.
- Existing supplier-history browser harness: desktop/mobile archives, receipt coverage, supplier details, filters and pagination passed with synthetic data and blocked actions.
- Existing POS browser harness: desktop/mobile customer search, registration selection, cash/card/split, invalid-payment rejection and cart clearing passed with synthetic data and blocked actions.
- Production responses: CSP/HSTS/Secure cookies/private no-store/readiness passed.
- Browser JavaScript errors: zero in live smoke; login screenshot visually checked.
- Migration validation: PASS for 64 forward migrations. Secret scan: PASS. Git diff --check: PASS.
- Production dependency audit: zero vulnerabilities.

Evidence is in ignored `tmp/consolidation-evidence/`, `tmp/consolidation-tests-final.json`, and the existing local browser harness output folders.

## Cleanup and recovery

Cleanup status: COMPLETE for the workspace. `greenchoice-production-hardening`, `greenchoice-release-readiness`, and `greenchoice-release-20260903` are absent from the workspace; `greenchoice-workstation` is the only GreenChoice project folder here.

Permanent deletion was blocked by automatic safety review (reason: "blocked by policy"). The safer reversible alternative was used: redundant folders were archived under the recovery directory\'s `retired-folders/`. The old release worktree was moved through Git, preserving its history and uncommitted state. The hardening snapshot has root files at `retired-folders/greenchoice-production-hardening/` and its remaining directory tree at `remaining-directories/`, because PowerShell initially stopped at hidden Git metadata; the final forced move completed. For straightforward recovery use the verified before ZIP and Git bundle. No competing development folder remains in the workspace.

Verified recovery archives and full Git history bundles: `C:\Users\MthokozisiP\.codex\backups\greenchoice-consolidation-20261006-090429`. They preserve source/uncommitted work, required private configuration, historical assets, and the older release worktree. These are recovery artifacts outside the application workspace, not additional development projects.

## Remaining production attention

1. Confirm database migration history against each target and apply pending migrations before release. In particular, the new consolidated security follow-up is local source only. No production database, Vercel environment, or deployment was modified.
2. The full development dependency audit still reports 13 advisories (including critical tinypool issues). Automated remediation proposes major Vitest/Tailwind changes; undertake a separate tested toolchain upgrade. Production dependencies audit clean.
3. Existing authenticated business-action rate limiting can fall back to an in-memory window if configured providers fail (`lib/security.ts`, `lib/rate-limit.ts`). This gives weaker distributed limits during an outage. Login uses production fail-closed behavior.
4. Dedicated credential-dependent onboarding/password-change E2E coverage still needs explicit configured test accounts; it was reported as skipped rather than claimed passing.

## Files modified by this consolidation

- `.env.staging.example`
- `.github/workflows/production-gates.yml`
- `AGENTS.md`
- `README.md`
- `app/account/audit/page.tsx`
- `app/api/auth/access-decision/route.ts`
- `app/api/auth/login-form/route.ts`
- `app/api/auth/login/route.ts`
- `app/api/health/readiness/route.ts`
- `app/dashboard/manager/actions.ts`
- `components/receptionist/ReceptionistPOSPage.tsx`
- `lib/account-data.ts`
- `lib/cache/redis.ts`
- `lib/customer/auth.ts`
- `lib/customer/catalog.ts`
- `lib/dal/auth.ts`
- `lib/dashboard-session.ts`
- `lib/environment.ts`
- `lib/logger.ts`
- `lib/manual-manager-registration.ts`
- `lib/receptionist/customers.ts`
- `lib/supabase/client.ts`
- `lib/supabase/server.ts`
- `next-env.d.ts`
- `package-lock.json`
- `package.json`
- `playwright.config.ts`
- `proxy.ts`
- `scripts/run-with-local-env.mjs`
- `scripts/sync-pos-customer-search.mjs`
- `scripts/verify-local-customer-search.mjs`
- `scripts/verify-local-environment.mjs`
- `tests/local/customer-flow.mjs`
- `tests/security/customer-feature-gate.test.ts`
- `tests/security/repository-security.test.ts`
- `tests/unit/add-stock-action.test.ts`
- `tests/unit/test-customer-admin.test.ts`

## Files added (including reconciled migration names)

- `.vercelignore`
- `app/dashboard/manager/error.tsx`
- `app/dashboard/receptionist/error.tsx`
- `docs/staging-environment.md`
- `lib/auth-errors.ts`
- `lib/supabase/fetch.ts`
- `lib/supabase/proxy.ts`
- `lib/supabase/session-cookies.ts`
- `scripts/run-with-staging-env.mjs`
- `scripts/verify-staging-environment.d.mts`
- `scripts/verify-staging-environment.mjs`
- `supabase/migrations/20260813092547_direct_account_onboarding.sql`
- `supabase/migrations/20260814121258_customer_portal.sql`
- `supabase/migrations/20260814121414_customer_portal_indexes.sql`
- `supabase/migrations/20260814132128_fix_customer_phone_constraint.sql`
- `supabase/migrations/20260814133639_add_database_rate_limit_fallback.sql`
- `supabase/migrations/20260814135215_grant_customer_server_access.sql`
- `supabase/migrations/20260817104106_add_customer_test_account_marker.sql`
- `supabase/migrations/20260817132259_grant_customer_cart_server_access.sql`
- `supabase/migrations/20260902090000_release_security_hardening.sql`
- `supabase/migrations/20260917071558_supplier_management_hardening.sql`
- `supabase/migrations/20261006072152_consolidated_security_followup.sql`
- `tests/unit/auth-errors.test.ts`
- `tests/unit/cache-redis.test.ts`
- `tests/unit/readiness-route.test.ts`
- `tests/unit/staging-environment-config.test.ts`
- `tests/unit/supabase-proxy-session.test.ts`

The seven old migration aliases are replaced by the reconciled names above. `docs/CONSOLIDATION_REPORT.md` is also new. Existing user changes outside this list were retained.

## Git status snapshot

The work remains uncommitted in the existing repository. The pre-existing large working diff remains; no staged work was discarded.

```text
 M .env.example
 M .env.production.example
 M .env.staging.example
 M .github/workflows/production-gates.yml
 M .gitignore
 M AGENTS.md
 M README.md
 M app/account/audit/page.tsx
 M app/api/auth/access-decision/route.ts
 M app/api/auth/customer-register/route.ts
 M app/api/auth/login-form/route.ts
 M app/api/auth/login/route.ts
 M app/api/health/readiness/route.ts
 M app/auth/callback/route.ts
 M app/customer/actions.ts
 M app/customer/checkout/page.tsx
 M app/customer/orders/[orderId]/confirmed/page.tsx
 M app/customer/orders/page.tsx
 M app/customer/page.tsx
 M app/customer/profile/[section]/page.tsx
 M app/customer/profile/page.tsx
 M app/customer/saved/page.tsx
 M app/customer/stores/[storeId]/page.tsx
 M app/customer/stores/page.tsx
 M app/dashboard/account-actions.ts
 M app/dashboard/account/page.tsx
 M app/dashboard/manager/actions.ts
 M app/dashboard/manager/inventory/manage/page.tsx
 M app/dashboard/manager/sales/page.tsx
 M app/dashboard/receptionist/actions.ts
 M app/dashboard/receptionist/page.tsx
 M app/dashboard/receptionist/products/page.tsx
 M components/GreenChoiceDashboard.tsx
 D components/TopBarVisibility.tsx
 M components/account/AccountManagementForms.tsx
 M components/account/DashboardAccountMenu.tsx
 D components/account/DashboardAccountPanel.tsx
 M components/customer/CustomerCheckout.tsx
 M components/customer/CustomerCurrentOrder.tsx
 M components/customer/CustomerHeader.tsx
 M components/customer/CustomerOrderCard.tsx
 M components/customer/CustomerShell.tsx
 M components/manager/ManagerDashboardActions.tsx
 D components/manager/ManagerForms.tsx
 D components/manager/ManagerInfoPanel.tsx
 M components/manager/forms/shared.tsx
 M components/receptionist/ReceptionistPOSPage.tsx
 M components/receptionist/pos/ReceptionistPOS.tsx
 M components/receptionist/pos/pos-types.ts
 M eslint.config.mjs
 M instrumentation-client.ts
 M lib/account-data.ts
 D lib/admin-profile.ts
 M lib/cache/redis.ts
 M lib/customer/auth.ts
 M lib/customer/catalog.ts
 M lib/customer/orders.ts
 M lib/dal/auth.ts
 D lib/dashboard-auth.ts
 M lib/dashboard-session.ts
 M lib/dashboard-visuals.ts
 M lib/environment.ts
 M lib/logger.ts
 D lib/manager/invitation-email.ts
 M lib/manual-manager-registration.ts
 M lib/product-image-upload.ts
 D lib/staff-session.ts
 M lib/supabase/client.ts
 M lib/supabase/server.ts
 M next-env.d.ts
 M next.config.ts
 M package-lock.json
 M package.json
 M playwright.config.ts
 M proxy.ts
 D public/images/greenchoice-logo.png
 D public/images/manager-dashboard/new-manager-dashboard-reference.png
 D public/images/manager/badges-for-onboarding.png
 D public/images/manager/panels/add-products-panel-dark.png
 D public/images/manager/panels/create-staff-panel-dark.png
 D public/images/manager/panels/main-manager-dashboard-panel.png
 D public/images/manager/panels/manage-inventory-panel-dark.png
 D public/images/manager/panels/manage-staff-accounts-panel-dark.png
 D public/images/manager/panels/manager-dashboard-welcome-panel.png
 D public/images/manager/panels/manager-panel.png
 D public/images/manager/panels/new-admin-dashboard.png
 D public/images/manager/panels/new-new-manager-panel.png
 D public/images/manager/panels/panel-manager.png
 D public/images/manager/panels/view-inventory-panel-dark.png
 D public/images/modulars/edibles/edible-modular.png
 D public/images/product-placeholders/flower/greenhouse.png
 D public/images/product-placeholders/flower/indoor.png
 D public/images/product-placeholders/flower/outdoor.png
 D public/images/receptionist/concentrates.png
 D public/images/receptionist/edibles-beverages.png
 D public/images/receptionist/edibles-chocolates.png
 D public/images/receptionist/edibles-cookies.png
 D public/images/receptionist/edibles-gummies.png
 D public/images/receptionist/flowers-variations.png
 D public/images/receptionist/flowers.png
 D public/images/receptionist/oil.png
 D public/images/receptionist/pre-rolls.png
 D public/images/receptionist/vape-battery.png
 D public/images/receptionist/vape-cartridges.png
 D public/images/receptionist/vape-disposable.png
 D public/modulars/hybrid-modular.png
 D public/modulars/indica-modular.png
 D public/modulars/sativa-modular.png
 M scripts/run-with-local-env.mjs
 M scripts/verify-local-environment.mjs
 M sentry.edge.config.ts
 M sentry.server.config.ts
 D supabase/migrations/20260814090000_customer_portal.sql
 D supabase/migrations/20260814102000_customer_portal_indexes.sql
 D supabase/migrations/20260814133000_fix_customer_phone_constraint.sql
 D supabase/migrations/20260814135000_add_database_rate_limit_fallback.sql
 D supabase/migrations/20260814140000_grant_customer_server_access.sql
 D supabase/migrations/20260817103000_add_customer_test_account_marker.sql
 D supabase/migrations/20260817150042_grant_customer_cart_server_access.sql
 M tests/security/customer-feature-gate.test.ts
 M tests/security/product-image-upload.test.ts
 M tests/security/repository-security.test.ts
 M tests/unit/account-flow.test.ts
 M tests/unit/customer-experience-ui.test.ts
 M tests/unit/mobile-portrait-layout.test.ts
 M tests/unit/pending-orders-ui.test.ts
 M tests/unit/receptionist-checkout-action.test.ts
 M tests/unit/receptionist-pos-floating-checkout.test.ts
 M tests/unit/test-customer-admin.test.ts
?? .vercelignore
?? ADD_STOCK_REVIEW.md
?? CUSTOMER_REFACTOR_AUDIT.md
?? LOCAL_POS_CHECKOUT_REPORT.md
?? app/api/dashboard/
?? app/customer/addresses/
?? app/customer/alerts/
?? app/customer/cart/
?? app/customer/error.tsx
?? app/customer/loading.tsx
?? app/customer/shop/
?? app/dashboard/manager/error.tsx
?? app/dashboard/manager/inventory/manage/actions.ts
?? app/dashboard/manager/sales/actions.ts
?? app/dashboard/manager/sales/error.tsx
?? app/dashboard/manager/sales/loading.tsx
?? app/dashboard/manager/store/
?? app/dashboard/manager/suppliers/
?? app/dashboard/receptionist/error.tsx
?? components/customer/CustomerAddressCard.tsx
?? components/customer/CustomerAddressDeleteDialog.tsx
?? components/customer/CustomerAddressForm.tsx
?? components/customer/CustomerAddresses.tsx
?? components/customer/CustomerAlertItem.tsx
?? components/customer/CustomerBottomNavigation.tsx
?? components/manager/ManagerSalesOverviewUI.tsx
?? components/manager/ManagerStoreForm.tsx
?? components/manager/SupplierManagement.module.css
?? components/manager/SupplierManagement.tsx
?? components/manager/forms/AddStockForm.module.css
?? components/manager/forms/AddStockForm.tsx
?? components/manager/grouped-table-styles.ts
?? components/receptionist/pos/CustomerCheckoutDialog.tsx
?? docs/CONSOLIDATION_REPORT.md
?? docs/staging-environment.md
?? lib/auth-errors.ts
?? lib/customer/address-validation.ts
?? lib/customer/addresses.ts
?? lib/customer/alert-model.ts
?? lib/customer/alerts.ts
?? lib/customer/navigation.ts
?? lib/manager/add-stock-suppliers.ts
?? lib/manager/add-stock-validation.ts
?? lib/manager/sales-overview.ts
?? lib/manager/sales-report-pdf.ts
?? lib/manager/store-settings-fields.ts
?? lib/manager/store-settings-validation.ts
?? lib/manager/store-settings.ts
?? lib/manager/supplier-options.ts
?? lib/manager/supplier-validation.ts
?? lib/manager/suppliers.ts
?? lib/manager/supply-history.ts
?? lib/pos-customer-format.ts
?? lib/pos-payment.ts
?? lib/receptionist/customer-search-index.ts
?? lib/receptionist/customers.ts
?? lib/supabase/fetch.ts
?? lib/supabase/proxy.ts
?? lib/supabase/session-cookies.ts
?? scripts/run-with-staging-env.mjs
?? scripts/sync-pos-customer-search.mjs
?? scripts/verify-local-customer-search.mjs
?? scripts/verify-staging-environment.d.mts
?? scripts/verify-staging-environment.mjs
?? supabase/migrations/20260813092547_direct_account_onboarding.sql
?? supabase/migrations/20260814121258_customer_portal.sql
?? supabase/migrations/20260814121414_customer_portal_indexes.sql
?? supabase/migrations/20260814132128_fix_customer_phone_constraint.sql
?? supabase/migrations/20260814133639_add_database_rate_limit_fallback.sql
?? supabase/migrations/20260814135215_grant_customer_server_access.sql
?? supabase/migrations/20260817104106_add_customer_test_account_marker.sql
?? supabase/migrations/20260817132259_grant_customer_cart_server_access.sql
?? supabase/migrations/20260830180534_pos_customer_sales_overview.sql
?? supabase/migrations/20260902090000_release_security_hardening.sql
?? supabase/migrations/20260902100242_secure_manager_store_updates.sql
?? supabase/migrations/20260909122435_pos_payment_and_customer_search.sql
?? supabase/migrations/20260917063849_supplier_management.sql
?? supabase/migrations/20260917071558_supplier_management_hardening.sql
?? supabase/migrations/20260929104753_supplier_profile_metadata.sql
?? supabase/migrations/20261001120000_pos_customer_search_outbox.sql
?? supabase/migrations/20261003084933_customer_default_address.sql
?? supabase/migrations/20261006072152_consolidated_security_followup.sql
?? tests/e2e/manager-sales-overview.spec.ts
?? tests/fixtures/
?? tests/local/
?? tests/security/manager-sales-overview-security.test.ts
?? tests/security/manager-store-security.test.ts
?? tests/unit/add-stock-action.test.ts
?? tests/unit/add-stock-validation.test.ts
?? tests/unit/auth-errors.test.ts
?? tests/unit/cache-redis.test.ts
?? tests/unit/customer-address-actions.test.ts
?? tests/unit/customer-alerts.test.ts
?? tests/unit/customer-navigation.test.ts
?? tests/unit/customer-search-index.test.ts
?? tests/unit/manager-sales-overview.test.ts
?? tests/unit/manager-store-ui.test.ts
?? tests/unit/pos-payment.test.ts
?? tests/unit/readiness-route.test.ts
?? tests/unit/receptionist-customer-search.test.ts
?? tests/unit/staging-environment-config.test.ts
?? tests/unit/supabase-proxy-session.test.ts
?? tests/unit/supplier-table-history.test.tsx
?? tests/unit/supplier-validation.test.ts
?? tests/unit/supply-history.test.ts
```

## Documentation checked

- [Supabase SSR session verification](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs)
- [Next.js Proxy API](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
- [Next.js 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
