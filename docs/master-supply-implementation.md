# Master Supply implementation

## Architecture

Master Supply belongs to a franchise. Central products and receipts live in `master_supply_products` and `master_supply_receipts`. Requests, approvals, distributions, dispatch, store receipt, and discrepancies have separate records. A distribution reserves central stock when created, removes it from central custody when dispatched, and adds only the manager-confirmed quantity to store stock. The shortfall remains recorded on the distribution.

The existing `products` and `inventory_stock` tables remain the operational POS inventory. A confirmed Master Supply receipt creates a source-specific, unpublished POS product for that store, labeled `(Master Supply)`. This gives the receptionist a distinct listing when the store already sells an identical independently sourced product. Online checkout continues to reserve published supplier products without crossing the Master Supply stock guard. A database trigger prevents publication of the Master Supply POS listing.

Each Master Supply POS sale item creates a source allocation in the same transaction as the existing stock deduction. The allocation and source balance update roll back if checkout fails. The stock guard prevents other inventory changes from silently consuming unallocated Master Supply units. Existing independently sourced products and supplier workflows remain separate. Full POS refunds remove units from net sold reporting; a manager can return inspected units to stock through the explicit restock action.

The mutation RPC rechecks actor role, franchise, store, quantities, and current status in PostgreSQL. It is executable by `service_role` only and is called from authenticated server actions. New tables have read-only RLS for the franchise admin and the relevant store manager. The UI subscribes to franchise-filtered database changes, including a refund event, and refreshes server snapshots.

## Screens and workflow

- Franchise dashboard links to the five-KPI overview and store detail pages.
- Master Inventory supports product registration, receiving, search, category-dependent filters, pagination, product detail, and audited central adjustment. Its six KPI cards show available central units (`on_hand - reserved`) and select the matching category; clicking the active KPI resets to the mandatory Flower default. The six-category dropdown groups vape cartridges with disposable vapes, and its subcategories come from the franchise's registered central products in the Receptionist classification order. Strain Type appears for Flower and Pre-Rolls, and Cultivation appears only for Flower.
- Distribute Supply is the sole distribution form. Its compact store, delivery, product table, and summary layout uses the Receptionist wallpaper and shared product-image resolver, including cultivation images. Category-dependent filters match Master Inventory; the table uses five products per page by default. Direct distributions and approved requests use the same review and confirmation path, with quantities capped by central availability and request approval. Request conversion fixes the destination store.
- Supply Requests supports approval, partial approval, rejection, and conversion.
- Distribution History supports detail expansion, filters, pagination, dispatch/cancel actions, and PDF export from actual records. Its main table has no distribution ID column.
- Franchise store managers can request products, track requests and incoming distributions, confirm actual receipt, inspect source stock, and explicitly restock suitable units from fully refunded sales.
- New supply pages reuse the existing `DashboardBackdrop` receptionist wallpaper.

## Validation and rollout

The new migration is `supabase/migrations/20261019132156_master_supply.sql`. It has been exercised with an isolated PGlite schema, checked by the repository's migration validator, and applied to the verified **GreenChoice Staging** Supabase project after explicit user approval. Staging records it as version `20261019132156`. It has **not** been applied to production. No code deployment, push, or commit was performed.

Before production rollout, verify a complete flow in staging with real accounts: central receipt → manager request → approval → distribution → dispatch → actual receipt → receptionist sale → full refund → inspected restock. Check RLS with two franchise accounts, one independent store, and a manager from each franchise. Check the customer online checkout path against an existing published supplier product. Capture and compare the overview and store-detail screens once their missing visual references are supplied.

The supplied ZIP contained reference images for Master Inventory, Distribute Supply, Distribution History, and Supply Requests. It did not contain the overview or store-detail references, so those two layouts follow the written requirements and existing GreenChoice styling pending visual comparison.
