# Completed Sale Confirmation

The receptionist POS opens a native, centred confirmation dialog after the existing `complete_receptionist_sale_v3` RPC returns a saved sale ID. The receipt is subsequently read from the database under the signed-in user's RLS context. A failed checkout leaves the cart available for retry with the same idempotency key. An interrupted receipt request provides a reload action without repeating checkout.

The dialog follows the supplied dark-green reference, including the success icon, customer/payment/reference cards, purchased products, rand totals, split allocations and four action buttons. It supports internal scrolling, a bounded product table, native focus trapping, Escape and keyboard focus indicators. Continue Selling resets the completed checkout; opening history during an unfinished checkout preserves that checkout.

## Files

- `components/receptionist/pos/ReceptionistPOS.tsx`: successful-checkout hook, history entry point, checkout error recovery and reset.
- `components/receptionist/pos/TransactionWorkspace.tsx`: receipt, store history/search/date filtering/pagination, correction and refund review, audit details.
- `app/globals.css`: responsive confirmation styling.
- `app/dashboard/receptionist/actions.ts`: require a saved sale ID before acknowledging success.
- `app/dashboard/receptionist/transactions.ts`: authenticated receipt/history actions and origin-checked, rate-limited amendment action; actor/store identity comes from the session.
- `lib/pos-receipt.ts`: serializable receipt model and rand formatting.
- `components/manager/ManagerSalesOverviewUI.tsx`: receipt/audit inspection, refund and net revenue details, refresh after amendments.
- `lib/manager/sales-overview.ts`: deduct refunded amounts once from filtered revenue and calendar KPIs while retaining original totals.
- `lib/manager/sales-report-pdf.ts`: original total, refund amount and net revenue in the existing export.
- `supabase/migrations/20261016095315_pos_sale_confirmation.sql`: database changes described below.
- `tests/unit/pos-transaction-actions.test.ts`, `tests/unit/manager-sales-overview.test.ts`: action security/error paths and refund reporting.
- `tests/local/pos-confirmation-database.mjs`, `tests/local/pos-confirmation-browser.mjs`: reproducible isolated PostgreSQL and browser integration checks.

## Database and financial behavior

The new migration adds customer/product receipt snapshots, payment-provider identification, refunded amount, a generated refund status and an optimistic amendment version. It adds `pos_sale_events` with original and updated allocations, amount, reason, staff name/identity, timestamp and unique request ID. Authenticated users can read events under store RLS. The service role receives only SELECT and INSERT on the event table, preserving append-only history through application credentials.

Read RPCs use security-invoker/RLS. The mutation RPC is executable only by the service role and independently checks active staff, role and store access. It locks the sale row, validates cents and allocations, rejects stale versions and reused request IDs, and commits the event and sale amendment together. Original sale/item totals are retained. Existing checkout and stock processing remain in place.

Payment corrections only correct the recorded tender; they never charge, transfer or reverse money. A reason and a separate review/confirmation step are required.

The correction form uses a centred dialog capped at 520px, with Card/Cash/Split Payment selection buttons, a green selection state, conditional split amounts and a required Reason for Change. It replaces the receipt content while open. Confirm Change opens a final review with original/new methods before any database request; Cancel returns to the saved receipt. The original checkout method comes from the earliest correction audit entry when earlier corrections exist. The existing mutation action, validation, audit and manager reporting remain unchanged. The responsive browser harness also checks cancellation without a mutation, invalid/unchanged allocations, final review and original-method preservation after correction.

Refunds currently record a full remaining refund for an otherwise unrefunded sale. The operator must confirm that money has already been returned via the original payment methods, including an external terminal when applicable. Recording a refund does not itself send money. Duplicate refunds, further amendments of refunded sales, historical unrecorded payments and provider-linked/online-order amendments are blocked. Physical inventory returns/restocking are a separate workflow and this feature never adds stock automatically.

## Verification

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm run validate:migrations`: passed, 72 forward migrations.
- Focused Vitest run: 38 tests passed across checkout, payments, transaction actions, POS feedback, manager reporting and reporting security.
- `node tests/local/pos-confirmation-database.mjs`: passed using real migration SQL in isolated PGlite PostgreSQL with synthetic base-schema fixtures. Covered Cash/Card/Split checkout and retries, rollback for invalid allocations, original-payment audits, stale amendments, store isolation, inactive staff, provider blocking, external refund confirmation, duplicate refunds, net revenue, unchanged stock, history filtering, RLS reads and denied direct writes.
- `node tests/local/pos-confirmation-browser.mjs`: passed at 1440×1000, 1024×768 and 390×844. Actual React POS/receipt components call local HTTP adapters backed by the same PostgreSQL RPCs. Covered failure before success, all three payment methods, correction/refund review and save, history, reset, 60 products with long names, internal scrolling and no JavaScript errors or page overflow. These adapters replace Next.js server-action transport; server-action authentication/origin/validation is covered separately by unit tests.
- Full `npm run test` was run: it also collected eight pre-existing Playwright files from `tests/local`, which Vitest cannot execute, and encountered a wallpaper assertion and two timeouts. A bounded rerun with `npx vitest run tests/unit tests/security --maxWorkers=2` completed with **507 passed, 1 failed**. The remaining failure is the existing `customer-experience-ui.test.ts` assertion for `opacity-62 saturate-125` in `GreenChoiceDashboard.tsx`, which this feature does not change.
- `npm run test:e2e`: **2 passed, 7 skipped, 1 failed**. The failure expects `/register` to redirect to `/login`, but the existing registration route remains `/register`. Credential-dependent tests were skipped by their own guards.

Screenshots from the isolated browser checks are in `tmp/pos-confirmation/` (`sale-1440.png`, `sale-1024.png`, `sale-390.png` and `many-products-*`). No customer or financial production data was created by these checks.

## Deployment and remaining integrations

The migration was applied to the local app's remote **staging** database on 16 October 2026 after diagnosing a missing `get_pos_receipt` function. The previously saved Card sale with two products was readable after migration under the sale staff member's authenticated RLS context. No sale was resubmitted. Production has not been migrated; apply this migration through the normal deployment process before deploying these application changes there. Existing rows retain their original data; unavailable historical snapshot classifications display an em dash rather than invented values.

There is no integrated POS payment-provider refund adapter in this codebase. Provider-linked sales are therefore blocked from manual correction/refund recording. A future integration must set `payment_provider` at sale creation and use its own authenticated reconciliation/refund process, verified provider confirmation/webhooks and idempotency before recording success. Live terminal/provider refunds and real concurrent multi-connection PostgreSQL contention were not tested. PGlite tests verify SQL behavior and stale-version/idempotency protections, not live-provider settlement or production Supabase session configuration.
