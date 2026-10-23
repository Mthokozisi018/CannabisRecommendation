# Local Receptionist POS Checkout Report

Scope: local-only work in `greenchoice-workstation`. I did not push, deploy, edit production environment variables, apply production migrations, or modify production Supabase data.

## Slow Customer Search Cause

The visible delay was caused by two layers working together:

- The client search already had a 220 ms debounce and a small result limit, but it called a Server Action from a client effect without request cancellation or stale response protection. Slow searches could continue after the receptionist typed a newer query, and older responses could still compete with the current result set.
- The database search used leading-wildcard `ILIKE` filters across `phone_digits`, `first_name`, `surname`, and `full_name`, then ordered by `updated_at`. Existing B-tree-style indexes cannot help `%term%` searches, so larger active customer tables can fall back to scans even though the UI only requests 8 rows.

## Search Fix

- Added a read-only POST route at `app/api/dashboard/receptionist/customers/search/route.ts` so the browser can use `fetch` with `AbortController` and `request.signal`.
- Updated the checkout dialog to use one fast customer-search input, infer name versus cellphone search, debounce requests, abort stale searches, ignore late responses, and cache recent in-modal results.
- Kept Supabase as the source of truth and moved the search into `lib/receptionist/customers.ts` using the session Supabase client plus an explicit trusted store filter. That preserves RLS and store isolation instead of relying only on an admin client search.
- Added local migration indexes using `pg_trgm` partial GIN indexes for active customer name fields and a partial store recency index for active customers.
- Changed partial cellphone search to a bounded `phone_digits` prefix range so it can use the existing `(store_id, phone_digits)` B-tree index instead of a leading-wildcard phone scan.

## Modal Rebuild

The checkout is now a centered, cashier-friendly modal that keeps the sale in context instead of navigating away from the POS page. It combines customer search/registration, selected-customer state, current cart lines, totals, payment method, split cash/card inputs, complete sale, and return-to-POS controls in one dark GreenChoice surface modeled on the screenshot.

The modal reuses the existing cart state and checkout action wiring. Cart clear, quantity changes, product removal, customer selection, payment validation, duplicate-submit protection, stock guards, and Supabase-backed sale completion remain in the existing POS flow.

## Payment Storage

The checkout flow now sends a structured payment object:

- `cash`: full sale total in `cashAmount`, `cardAmount` set to `0`
- `card`: full sale total in `cardAmount`, `cashAmount` set to `0`
- `split`: receptionist-entered `cashAmount` and `cardAmount`, validated to add exactly to the final sale total

The local migration adds nullable historical columns on `public.pos_sales`:

- `payment_method text`
- `cash_amount numeric(12,2)`
- `card_amount numeric(12,2)`

It also adds a check constraint so new payment rows must have a valid method, non-negative values, no amount above the sale total, and exact cash/card totals. Historical sales can remain null because their tender is unknown.

The new `complete_receptionist_sale_v3` RPC wraps the existing `complete_receptionist_sale_v2` sale logic, then records the payment allocation on the same sale row in the same transaction. This keeps the current atomic sale, stock, customer, audit, and idempotency behavior instead of duplicating the checkout system.

## Registration Form

The new-customer registration form inputs start as empty strings and reset whenever the registration panel is toggled. The phone/cellphone registration input no longer has placeholder/example text. Name and surname registration inputs also have no placeholders.

## Changed Files

- `app/dashboard/receptionist/actions.ts`
- `app/api/dashboard/receptionist/customers/search/route.ts`
- `.gitignore`
- `eslint.config.mjs`
- `components/receptionist/ReceptionistPOSPage.tsx`
- `components/receptionist/pos/CustomerCheckoutDialog.tsx`
- `components/receptionist/pos/ReceptionistPOS.tsx`
- `components/receptionist/pos/pos-types.ts`
- `lib/pos-payment.ts`
- `lib/receptionist/customers.ts`
- `supabase/migrations/20260909122435_pos_payment_and_customer_search.sql`
- `tests/unit/receptionist-checkout-action.test.ts`
- `tests/unit/receptionist-customer-search.test.ts`
- `tests/unit/pos-payment.test.ts`
- `tests/security/repository-security.test.ts`
- `tests/local/pos-browser.mjs`
- `tests/local/pos-database.mjs`

There are many unrelated pre-existing dirty files in this workstation. I left those alone.

## Migration Status

A migration was required and prepared locally only:

`supabase/migrations/20260909122435_pos_payment_and_customer_search.sql`

I did not apply it to production. The checkout code expects `complete_receptionist_sale_v3` and the new `pos_sales` payment columns to exist before it can run against a real Supabase environment.

## Verification

Passed:

- `npm run lint`
- `npm run typecheck`
- `npm run validate:migrations` - 56 forward migrations validated
- `npm run scan:secrets` - 530 tracked and pending files scanned
- `npm run test` - 39 files, 224 tests passed
- `node tests/local/pos-database.mjs`
- `node tests/local/pos-browser.mjs`
- `node tests/local/pos-safe-build.mjs`
- Live dev-server verification at `http://localhost:3001` reached `/login`, rendered content and expected interactive fields, and had no Next/Vite error overlay.

`npm run audit:production` did not pass. It reports existing dependency advisories in `baseline-browser-mapping`, `browserslist`, `next@16.2.12`, and `sharp@0.35.3`; npm says the Next/sharp remediation requires a forced upgrade to `next@16.3.4`, so I did not perform that dependency upgrade inside this POS checkout task.

Database-local checks used isolated PGlite fixtures, not production Supabase. They verified:

- Cash, Card, and valid Split payments are saved on `pos_sales`
- Invalid split totals, negative values, over-total values, and values with more than 2 decimals are rejected and rolled back
- Retry idempotency does not create duplicate sales and rejects mismatched payment retry payloads
- Cross-store customers and deactivated staff cannot complete checkout
- Stock moved from 100 to 97 across three completed local sales
- Exactly 3 sales, 3 sale items, 3 stock movements, and 3 audit rows were created
- Authenticated customer RLS fixture could only see its own store data
- RPC execution grants are limited as intended

The local customer-search benchmark used 50,002 synthetic customers. The warmed selective searches improved from approximately 133/118/0.9 ms before the local search indexes/query changes to 8.3/6.4/0.9 ms after them. `EXPLAIN` shows trigram bitmap scans for name search and an index scan on `pos_customers_store_phone_digits_idx` for bounded phone-prefix search.

Browser-local checks used a local Playwright server with external requests blocked. They verified:

- Cash checkout
- Card checkout
- Valid split checkout with R300 cash and R450 card on a R750 sale
- Invalid split payments cannot complete
- Rapid existing-customer search makes one debounced request and suppresses stale slower results
- Registration fields start blank on desktop and mobile
- Registration still selects the new customer
- Full POS flow adds a product, clears all items while keeping the modal open, searches/selects a customer, completes Cash/Card/Split checkout, closes the dialog, and clears the cart
- Mobile viewport 390x844 and desktop viewport 1440x1000 had no horizontal overflow or browser page errors

## Risks And Remaining Issues

- The migration has not been applied to any real database. That is intentional for this task.
- Historical `pos_sales` rows keep null payment fields because their cash/card allocation is unknown.
- Sales Overview and report screens are not yet changed to display the new payment breakdown. The data is now stored for that later work.
- The search benchmark is local and synthetic. It confirms the query plan and relative improvement, but production latency still depends on actual table size, hardware, and network conditions.
- Building the trigram indexes on a live large table will need normal release planning because index creation can take time.
