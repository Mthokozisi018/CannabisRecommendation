# Franchise demonstration data — 12 October 2026

Completed on **GreenChoice Staging** (`jezbvjepxosphdrykrcg`), isolated from the configured production project (`nfrvbnthsmlyqzmvqylh`). No production writes, schema changes, policy changes, frontend changes, authentication changes, payment gateway requests, or new staff accounts were made.

Existing account: `franchise.admin@example.com`, auth ID `d1455363-b2ac-404b-918f-f6b56c69416f`, profile ID `7bb3c3b3-7896-4c19-9c5c-0cd6fbaa2ca7`, unchanged active `franchise_admin` role. Existing franchise: **GreenChoice Demo Franchise**, ID `ec7730b6-27b2-4d86-8ba6-16c387060831`. Its existing **Green Gorilla** store was preserved, so the directory now contains six stores: five newly requested demo stores plus that original store.

The dataset covers **15 July–12 October 2026**, 90 days inclusive, in `Africa/Johannesburg`. All five stores are active. Sales are completed fictional POS records with cash/card/split payment amounts recorded only in the database. Prices and quantities generate totals; no KPI rows were inserted. Seven category snapshots per store support category charts. Fictional customers have explicit Demo names and fictional telephone display labels; the normalized telephone values exist solely to satisfy database constraints and must never be used for outbound contact.

| Demo store | Location | Transactions | Total revenue | Average transaction | Customers | September revenue |
|---|---|---:|---:|---:|---:|---:|
| Pretoria Central Branch | Pretoria CBD | 668 | R250,310.00 | R374.72 | 105 | R79,860.00 |
| Menlyn Branch | Menlyn, Pretoria | 865 | R430,570.00 | R497.77 | 170 | R149,590.00 |
| Centurion Branch | Centurion | 777 | R331,640.00 | R426.82 | 135 | R106,370.00 |
| Hatfield Branch | Hatfield, Pretoria | 624 | R197,310.00 | R316.20 | 85 | R63,825.00 |
| Midrand Branch | Midrand | 815 | R366,945.00 | R450.24 | 150 | R127,885.00 |
| **Total** | | **3,749** | **R1,576,775.00** | | **645** | **R527,530.00** |

Franchise revenue equals the sum above because the preserved store had no existing sales. Calendar KPIs as of 12 October: week R15,545.00, month R236,170.00, year R1,576,775.00. Monthly history: July R285,375.00 (partial month), August R527,700.00, September R527,530.00, October R236,170.00 (partial month). These are query results, not inserted aggregates.

## Records written

- `stores`: 5
- `products`: 35 (7 per store; unpublished and hidden from POS catalog browsing)
- `pos_customers`: 645
- `pos_sales`: 3,749
- `pos_sale_items`: 6,647
- `pos_customer_search_outbox`: 645 automatic trigger entries belonging to the new customers

The existing categories were referenced without modification. Inventory and staff assignments were unnecessary for historical sales and were not created. Sale staff IDs are null rather than attributing fictional receptionist activity to the administrator.

## Verification

- Exactly five deterministic demo store IDs belong to the existing franchise.
- All pre-existing rows were compared using counts and sorted full-row MD5 digests across **every public base table**, plus `auth.users`. All matched after excluding only the new demo records. Franchise, profile, credentials, existing stores and business data were unchanged.
- All 94 existing RLS policies were compared by digest and remained unchanged.
- Authenticated-role queries with the target account's JWT subject returned six owned stores, five demo stores, all 3,749 demo sales, 645 customers and 6,647 items, and zero stores outside its franchise.
- An existing unrelated store manager's authenticated-role context returned zero demo stores, sales or customers. There is only one franchise administrator in staging, so an actual second-franchise administrator was unavailable for a cross-franchise test. Existing restrictive franchise ownership policies remain in place.
- Sale totals equal item sums; item totals equal quantities multiplied by snapshot unit prices; every product and customer belongs to its sale's store. Payment allocations reconcile to totals.
- The seed was executed a second time. Full-row digests and counts for all public tables, authentication users and policies remained identical, including the search outbox. Reruns add no duplicates and perform no updates.
- `scripts/verify-franchise-demo.ts` passed against the staging REST API. It uses the dashboard's ownership joins, completed-sale filters, date bounds, store filters and 500-row pagination, and calls the existing `summarizeFranchiseSales` and `summarizeSaleItems` functions. It verified the 90-day and September ranges, seven categories per store, item reconciliation, calendar KPIs and the franchise/store revenue sum. REST checks use the staging server credential; ordinary user access was checked separately using RLS queries above.
- Interactive browser login was not performed; account credentials were neither requested nor changed.
- ESLint passed for the new TypeScript verification script; all five store IDs pass the application's existing UUID validation.

## Frontend display notes

Use the staging-connected application and log in with the existing credentials. The local runner already loads `.env.staging.local`; `.env.local` points to the other project and was preserved. Select **15 July–12 October 2026** to see the full dataset; the default report displays the current month.

The existing revenue chart plots daily points across the selected range rather than dedicated monthly buckets. Franchise transaction counts appear in the performance table; the current franchise KPI cards do not include a separate total-transactions card. Managers are unassigned and the homepage manager login/activity sections remain empty. Demo stores use the existing image fallback. The franchise reporting DAL currently passes an empty customer-name lookup to the sales history builder; customer IDs and counts are correct, but name enrichment remains unavailable (the current history table does not display customer names). The store history UI shows only the latest 20 transactions while the totals aggregate the complete selected range. Inventory balances were not seeded, so the low-stock panel can show demo products with zero available quantity. Average transaction values are calculated in this report but are not a current store KPI card. No features or pages were changed to address these existing presentation limits.

## Rerun and later removal

`scripts/seed-franchise-demo.sql` contains the atomic, rerunnable seed. Run it **only** against `jezbvjepxosphdrykrcg`. The account/franchise identities are checked before writes; existing IDs or slugs with conflicting ownership cause rollback. Stable IDs use `md5(namespace || entity-key)::uuid`, with namespace `greenchoice-franchise-demo-v1:ec7730b6-27b2-4d86-8ba6-16c387060831:`. Store slugs start with `gc-demo-fa-v1-`; store and product descriptions also mark the dataset.

Store IDs:

| Store | ID |
|---|---|
| Pretoria Central | `8b3d0bad-ea23-efb1-7649-394a95851656` |
| Menlyn | `d8d2d0ba-4dc5-3ba5-40ea-0d9669038184` |
| Centurion | `8686840d-d236-7d67-3c30-14843bf621d6` |
| Hatfield | `ae2eca9d-493a-2c61-4326-fe124da0a626` |
| Midrand | `fda6d384-f687-906d-735c-3e9cbf6280a8` |

For later removal, regenerate the **exact entity IDs from the fixed seed loops**, verify ownership, and check for legitimate records added since seeding. Delete only those generated line items, sales, products, customers, their outbox entries, and finally the five stores, in one transaction. Do not delete by franchise alone or cascade all descendants: legitimate later records must be preserved, and a demo store with legitimate dependants must remain. Customer deletion queues a search-outbox tombstone automatically; retain it until any external demo search document is removed, then remove that exact demo outbox entry. The existing franchise, account and Green Gorilla store must remain.

Run the read-only verification from `greenchoice-workstation`:

```powershell
node scripts/run-with-local-env.mjs node_modules/tsx/dist/cli.mjs scripts/verify-franchise-demo.ts
```
