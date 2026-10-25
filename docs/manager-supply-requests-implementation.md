# Manager Suppliers and Master Inventory supply requests

Date: 23 October 2026. Implementation is local; no deployment or shared database writes were performed.

## Changes

- `/dashboard/manager/suppliers`: removed only this page's custom GreenChoice/Active Store/manager header. The existing Back button, Suppliers heading, supplier registration, supplier profiles and supply transactions remain.
- Added View Supply Requests and Send Supply Request beside the heading. Eligibility comes from an authenticated database RPC, not a client flag or store query parameter. Missing membership, inactive accounts/stores, missing Franchise Admin relationships or database verification errors deny eligibility.
- `/dashboard/manager/suppliers/requests/new`: full-width Master Inventory catalogue, existing category/subcategory classification, applicable cultivation and strain filters, images, Available/Unavailable indicators, positive whole quantities, unique editable product selections, optional notes, review screen, native confirmation dialog, busy/error states and confirmed success.
- `/dashboard/manager/suppliers/requests`: own-store request history, requested/approved quantities, rejection reasons and linked distribution/receipt information. In Distribution is derived from the existing distribution lifecycle. Mobile history uses readable stacked rows.
- The legacy `/dashboard/manager/supply` page now uses the same safe catalogue and links to the new request interface. Existing receipt and refund/restock functionality remains. It no longer fetches or displays central balances.
- Franchise Admin request details show the submitting manager, submission time and manager notes. Rejection requires a reason, which managers can read. Approvals and conversion continue through the existing Master Supply actions and Distribute Supply screen.
- The existing local synthetic Franchise Admin supply demo now requires `GREENCHOICE_MASTER_SUPPLY_DEMO=true`, development mode and the exact test account. Default operation uses database records, so synthetic data does not silently hide real store requests. Do not enable this isolated demo while validating the real database workflow.

## Database changes

New forward migration: `supabase/migrations/20261023071927_manager_supply_requests.sql`.

No new request, product or distribution tables were created.

1. Adds `rejection_reason` to `master_supply_requests` (default empty; 500-character limit).
2. Restricts `master_supply_products` SELECT/RLS to Franchise Admins. Managers cannot read central on-hand, reserved, received totals, prices or acquisition costs, including through product Realtime subscriptions.
3. Adds authenticated, no-argument `manager_supply_context()` and `manager_supply_catalogue()` RPCs. Auth-bound private functions verify the manager's database store/franchise relationship and the active Franchise Admin. The catalogue returns only product identity/classification/image and an availability boolean. Public wrappers are SECURITY INVOKER; private definer functions have fixed search paths and explicit permissions. Anonymous calls are denied.
4. Moves the original transaction implementation into `private.master_supply_mutation_core` and retains the existing public service-role-only mutation entry point. The wrapper validates request availability, whole quantities, unique products, active store consistency, notes and request keys before delegating. It adds a rejection reason to review decisions within the same transaction.
5. Serializes request keys with an advisory transaction lock. Identical retries return the existing request; a reused key with a different payload/actor/store is rejected. Product validation locks are acquired in product-ID order. Request creation and its lines commit atomically.
6. Requests may exceed currently available stock; the fixed technical quantity limit of 1,000,000 is independent of stock. Unavailable/foreign products are denied without balance values in errors. Requests and approvals neither reserve nor deduct stock. Existing confirmed distribution reservation, dispatch deduction and receipt fulfillment logic is retained.

## Verification

- **104 tests passed across 21 supply-related test files.** Includes real SQL execution in a disposable PGlite PostgreSQL database with authenticated/anonymous/service roles and RLS assertions.
- Database cases include availability-only catalogue output, denied private balances/costs, independent/foreign franchise access, sibling-store request and line isolation, actor/store tampering, invalid quantities, unavailable/duplicate products, multi-product requests above available stock, atomic rollback, duplicate retry keys, approval/partial approval/rejection, conversion, dispatch, receipt, partial fulfillment, duplicate distribution/receipt denial and overlapping distribution reservation attempts.
- Server tests verify authentication before reads, verified active store matching, scoped queries, serialization whitelists, rejected manipulated submissions, reuse of the existing mutation and sanitized database errors.
- UI tests cover category-dependent filters, unavailable products, editing existing product quantities, multiple products, review/confirmation, database-confirmed success and retry without duplicate submission.
- Local Playwright browser harness passed at **1440, 768 and 390 pixels**: removed header, franchise buttons, independent-store omission, catalogue filtering, multi-product request/review/confirmation and own request history. No browser JavaScript errors or page overflow. Browser identities and responses were synthetic; authorization and SQL behavior were tested separately.
- TypeScript typecheck: passed.
- ESLint on changed application/test files: passed.
- Migration validation: passed for all 82 forward migrations.
- Optimized Next.js build: passed (including both new request routes).

Reproduce the browser checks with `node --import=tsx tests/local/manager-supply-browser.mjs`. Screenshots and results are under `tmp/manager-supply-verification/`.

## Application status and limits

The migration was executed only in the disposable local PostgreSQL test database. It has **not** been applied to the shared Supabase instance, staging or production. There was no deployment, production data modification or remote supply generation.

The local Supabase Docker engine was unavailable, so a real PostgREST/Realtime/authenticated Supabase browser session was not exercised with this migration. The migration must be applied to an isolated development database before checking this feature through a live account. Until those RPCs exist, the Suppliers page intentionally hides the franchise buttons and the request routes deny access.

PGlite executes concurrent calls through one connection; overlapping reservation/retry calls were tested, but this does not replace a multi-connection PostgreSQL contention test before rollout.

Existing unrelated workspace changes were preserved. The implementation does not alter Django, production configuration or deployment settings.
