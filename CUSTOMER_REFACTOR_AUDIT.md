# Customer dependency audit (before refactor)

Working tree: greenchoice-workstation. Existing uncommitted work is retained.

## Routes and reuse decisions

| Existing route | Decision |
|---|---|
| /customer | Replace old landing content with a redirect to Shop; store cards remain shared. |
| /customer/stores | Redirect directory to Shop; preserve /customer/stores/[storeId]. |
| /customer/orders | Submitted active orders and history; move draft-cart presentation to Cart. |
| /customer/checkout, /customer/orders/[orderId], /confirmed | Preserve checkout, details, confirmation and backend. |
| /customer/saved | Retain secondary route, favourites buttons, API and tables (store cards still use them). |
| /customer/profile, /profile/[section] | Keep account, identity, consent, support, preferences and logout; move Addresses to dedicated area. |
| /customer/register, /verify-email, /account-unavailable | Preserve public entry points and customer guards. |

## Backend and shared ownership

- layout -> requireCustomerSession -> customer_profiles; CustomerCartProvider -> cart API -> readCustomerCart -> carts/cart_items/products/inventory_stock.
- Store directory/cards -> catalog + favourites + image/status utilities; storefront -> CustomerStoreCatalog -> CustomerProductGrid -> shared workstation ProductCard/filter helpers. Flower/Pre-Rolls remain within store inventory.
- Order actions -> existing place_customer_order_v2 / cancellation RPC; orders DAL -> customer_id filters, order snapshots, fulfillment, tracking, payments and events. Historical orders retained.
- Address data already exists in customer_addresses, with self-owned RLS and a unique default index; profile and checkout read it. Preferences are not a notification delivery/feed service.
- QR/store registration and customer-store relationships remain in their existing authentication/registration and POS workflows. No shared manager/receptionist product or account components will be deleted.
- Shared customer UI: CustomerHeader, CustomerEmptyState, CustomerImage, CustomerStoreImage, CustomerStoreCard, CustomerOrderCard, CustomerCancelOrderButton, FavouriteButton, ShareStoreButton.
- No notification inbox/read-state service was found. Alerts must use real existing order events/statuses, without fictional delivery or read persistence.

## Import dependency map

Static imports/re-exports across application and tests; Next route/layout entry points are also framework consumers. URL references are listed separately. No deletions are authorized from this map alone.

### app/api/auth/customer-recover-account/route.ts

- Consumers: Next route entry point or no static alias consumer found.
- Data: customer_profiles

### app/api/auth/customer-register/route.ts

- Consumers: Next route entry point or no static alias consumer found.
- Data: customer_addresses, customer_consents, customer_preferences, customer_profiles

### app/api/customer/cart/route.ts

- Consumers: Next route entry point or no static alias consumer found.
- Data: cart_items, carts, inventory_stock, products, store_fulfillment_settings, stores

### app/api/customer/favourites/route.ts

- Consumers: Next route entry point or no static alias consumer found.
- Data: customer_favourites

### app/customer/account-unavailable/page.tsx

- Consumers: Next route entry point or no static alias consumer found.
- Data: No direct table access.

### app/customer/actions.ts

- Consumers: `components/customer/CustomerCheckout.tsx`, `components/customer/CustomerCancelOrderButton.tsx`, `app/customer/profile/[section]/page.tsx`, `app/customer/profile/page.tsx`
- Data: customer_addresses, customer_preferences, customer_profiles, customer_support_requests

### app/customer/checkout/page.tsx

- Consumers: Next route entry point or no static alias consumer found.
- Data: customer_addresses

### app/customer/layout.tsx

- Consumers: Next route entry point or no static alias consumer found.
- Data: No direct table access.

### app/customer/orders/[orderId]/confirmed/page.tsx

- Consumers: Next route entry point or no static alias consumer found.
- Data: No direct table access.

### app/customer/orders/[orderId]/page.tsx

- Consumers: Next route entry point or no static alias consumer found.
- Data: No direct table access.

### app/customer/orders/page.tsx

- Consumers: Next route entry point or no static alias consumer found.
- Data: No direct table access.

### app/customer/page.tsx

- Consumers: Next route entry point or no static alias consumer found.
- Data: customer_addresses

### app/customer/profile/[section]/page.tsx

- Consumers: Next route entry point or no static alias consumer found.
- Data: categories, customer_addresses, customer_preferences, customer_support_requests

### app/customer/profile/page.tsx

- Consumers: Next route entry point or no static alias consumer found.
- Data: customer_addresses

### app/customer/register/CustomerRegistrationForm.tsx

- Consumers: `app/customer/register/page.tsx`
- Data: No direct table access.

### app/customer/register/page.tsx

- Consumers: Next route entry point or no static alias consumer found.
- Data: No direct table access.

### app/customer/saved/page.tsx

- Consumers: Next route entry point or no static alias consumer found.
- Data: No direct table access.

### app/customer/stores/[storeId]/page.tsx

- Consumers: Next route entry point or no static alias consumer found.
- Data: No direct table access.

### app/customer/stores/page.tsx

- Consumers: Next route entry point or no static alias consumer found.
- Data: No direct table access.

### app/customer/verify-email/page.tsx

- Consumers: Next route entry point or no static alias consumer found.
- Data: No direct table access.

### components/customer/CustomerCancelOrderButton.tsx

- Consumers: `app/customer/orders/[orderId]/page.tsx`
- Data: No direct table access.

### components/customer/CustomerCartProvider.tsx

- Consumers: `components/customer/CustomerShell.tsx`, `components/customer/CustomerProductGrid.tsx`, `components/customer/CustomerCurrentOrder.tsx`, `components/customer/CustomerCheckout.tsx`, `app/customer/layout.tsx`
- Data: No direct table access.

### components/customer/CustomerCheckout.tsx

- Consumers: `app/customer/checkout/page.tsx`
- Data: No direct table access.

### components/customer/CustomerCurrentOrder.tsx

- Consumers: `app/customer/orders/page.tsx`
- Data: No direct table access.

### components/customer/CustomerEmptyState.tsx

- Consumers: `components/customer/CustomerNearbyStores.tsx`, `app/customer/stores/page.tsx`, `app/customer/saved/page.tsx`, `app/customer/orders/page.tsx`
- Data: No direct table access.

### components/customer/CustomerHeader.tsx

- Consumers: `app/customer/checkout/page.tsx`, `app/customer/stores/page.tsx`, `app/customer/saved/page.tsx`, `app/customer/page.tsx`, `app/customer/profile/page.tsx`, `app/customer/orders/[orderId]/page.tsx`, `app/customer/orders/[orderId]/confirmed/page.tsx`, `app/customer/orders/page.tsx`
- Data: No direct table access.

### components/customer/CustomerImage.tsx

- Consumers: `components/customer/CustomerStoreImage.tsx`, `components/customer/CustomerOrderCard.tsx`, `components/customer/CustomerCurrentOrder.tsx`, `components/customer/CustomerCheckout.tsx`, `app/customer/orders/[orderId]/page.tsx`
- Data: No direct table access.

### components/customer/CustomerNearbyStores.tsx

- Consumers: Next route entry point or no static alias consumer found.
- Data: No direct table access.

### components/customer/CustomerOrderCard.tsx

- Consumers: `app/customer/orders/[orderId]/page.tsx`, `app/customer/orders/page.tsx`
- Data: No direct table access.

### components/customer/CustomerProductGrid.tsx

- Consumers: `components/customer/CustomerStoreCatalog.tsx`
- Data: No direct table access.

### components/customer/CustomerShell.tsx

- Consumers: `app/customer/layout.tsx`
- Data: No direct table access.

### components/customer/CustomerStoreCard.tsx

- Consumers: `components/customer/CustomerNearbyStores.tsx`, `app/customer/stores/page.tsx`, `app/customer/saved/page.tsx`, `app/customer/page.tsx`
- Data: No direct table access.

### components/customer/CustomerStoreCatalog.tsx

- Consumers: `app/customer/stores/[storeId]/page.tsx`
- Data: No direct table access.

### components/customer/CustomerStoreImage.tsx

- Consumers: `components/customer/CustomerStoreCard.tsx`, `components/account/AccountManagementForms.tsx`
- Data: No direct table access.

### components/customer/FavouriteButton.tsx

- Consumers: `components/customer/CustomerStoreCard.tsx`
- Data: No direct table access.

### components/customer/SelectedStoreInfoBlock.tsx

- Consumers: `app/customer/stores/[storeId]/page.tsx`
- Data: No direct table access.

### components/customer/ShareStoreButton.tsx

- Consumers: Next route entry point or no static alias consumer found.
- Data: No direct table access.

### lib/customer/auth.ts

- Consumers: `lib/customer/orders.ts`, `lib/customer/favourites.ts`, `lib/customer/catalog.ts`, `app/customer/layout.tsx`, `app/customer/checkout/page.tsx`, `app/customer/actions.ts`, `app/customer/stores/page.tsx`, `app/customer/page.tsx`, `app/customer/profile/[section]/page.tsx`, `app/customer/profile/page.tsx`, `app/customer/orders/page.tsx`, `app/api/auth/login-form/route.ts`, `app/api/auth/access-decision/route.ts`, `app/api/auth/login/route.ts`, `app/api/customer/cart/route.ts`, `app/api/customer/favourites/route.ts`
- Data: customer_profiles

### lib/customer/cart.ts

- Consumers: `components/customer/CustomerCartProvider.tsx`, `app/customer/layout.tsx`, `app/customer/checkout/page.tsx`, `app/customer/actions.ts`, `app/customer/orders/page.tsx`, `app/api/customer/cart/route.ts`
- Data: carts, inventory_stock, products

### lib/customer/catalog.ts

- Consumers: `components/customer/SelectedStoreInfoBlock.tsx`, `components/customer/CustomerStoreCard.tsx`, `components/customer/CustomerNearbyStores.tsx`, `components/customer/CustomerCurrentOrder.tsx`, `components/customer/CustomerCheckout.tsx`, `app/customer/checkout/page.tsx`, `app/customer/stores/[storeId]/page.tsx`, `app/customer/stores/page.tsx`, `app/customer/saved/page.tsx`, `app/customer/page.tsx`, `app/customer/orders/page.tsx`
- Data: customer_store_views, inventory_stock, products, stores

### lib/customer/constants.ts

- Consumers: `lib/admin/test-customer.ts`, `app/api/auth/customer-register/route.ts`
- Data: No direct table access.

### lib/customer/favourites.ts

- Consumers: `app/customer/stores/page.tsx`, `app/customer/saved/page.tsx`, `app/customer/page.tsx`
- Data: customer_favourites

### lib/customer/orders.ts

- Consumers: `components/customer/CustomerOrderCard.tsx`, `app/customer/orders/[orderId]/page.tsx`, `app/customer/orders/[orderId]/confirmed/page.tsx`, `app/customer/orders/page.tsx`
- Data: order_items, orders

### lib/customer/store-images.ts

- Consumers: `components/customer/CustomerStoreImage.tsx`
- Data: No direct table access.

### lib/customer/store-status.ts

- Consumers: `tests/unit/customer-experience-ui.test.ts`, `components/customer/SelectedStoreInfoBlock.tsx`, `components/customer/CustomerStoreCard.tsx`
- Data: No direct table access.

### lib/customer/validation.ts

- Consumers: `tests/unit/customer-registration.test.ts`, `app/customer/actions.ts`, `app/customer/register/CustomerRegistrationForm.tsx`, `app/customer/profile/[section]/page.tsx`, `app/api/auth/customer-register/route.ts`, `app/api/auth/customer-recover-account/route.ts`
- Data: No direct table access.

## Customer URL consumers

- `tests/unit/pending-orders-ui.test.ts`: `/customer/orders`
- `tests/unit/customer-experience-ui.test.ts`: `/customer/profile/addresses`
- `proxy.ts`: `/customer`
- `lib/customer/auth.ts`: `/customer/account-unavailable`, `/customer/verify-email`
- `components/TopBar.tsx`: `/customer`
- `components/customer/CustomerShell.tsx`: `/customer`, `/customer/orders`, `/customer/profile`, `/customer/saved`, `/customer/stores`
- `components/customer/CustomerHeader.tsx`: `/customer`, `/customer/profile/notifications`
- `components/customer/CustomerCurrentOrder.tsx`: `/customer/stores`
- `components/customer/CustomerCheckout.tsx`: `/customer/stores`
- `app/customer/layout.tsx`: `/customer/account-unavailable`, `/customer/register`, `/customer/verify-email`
- `app/login/page.tsx`: `/customer/register`
- `app/customer/checkout/page.tsx`: `/customer/orders`
- `app/customer/actions.ts`: `/customer`, `/customer/orders`, `/customer/profile`, `/customer/profile/[section]`, `/customer/profile/addresses`, `/customer/profile/personal`, `/customer/profile/support`
- `app/customer/stores/[storeId]/page.tsx`: `/customer/stores`
- `app/customer/saved/page.tsx`: `/customer/stores`
- `app/auth/callback/route.ts`: `/customer`
- `app/customer/page.tsx`: `/customer/stores`
- `app/customer/register/CustomerRegistrationForm.tsx`: `/customer/verify-email`
- `app/dashboard/admin/test-customer/actions.ts`: `/customer`, `/customer/checkout`, `/customer/saved`
- `app/customer/profile/[section]/page.tsx`: `/customer/profile`
- `app/customer/profile/page.tsx`: `/customer/profile/addresses`, `/customer/profile/personal`
- `app/customer/orders/[orderId]/page.tsx`: `/customer/orders?view=track`
- `app/customer/orders/[orderId]/confirmed/page.tsx`: `/customer/stores`
- `app/customer/orders/page.tsx`: `/customer`, `/customer/stores`
- `app/dashboard/manager/store/actions.ts`: `/customer`, `/customer/stores`
- `app/api/auth/customer-register/route.ts`: `/customer`, `/customer/verify-email`
- `app/api/auth/login-form/route.ts`: `/customer`, `/customer/account-unavailable`, `/customer/verify-email`
- `app/api/auth/access-decision/route.ts`: `/customer`
- `app/dashboard/manager/orders/actions.ts`: `/customer/orders`
- `app/api/auth/login/route.ts`: `/customer`, `/customer/verify-email`
- `app/dashboard/account-actions.ts`: `/customer`, `/customer/stores`

## Implemented architecture

- `CustomerLayout` retains feature gating, active-customer authentication and the existing persistent cart provider.
- `CustomerShell` contains the shared layout. `CustomerBottomNavigation` uses one central five-destination configuration in `lib/customer/navigation.ts`.
- `/customer/shop` reuses the store directory, covers, favourites and store cards, with server-side store-name search. It loads stores only; full inventory remains under the existing `/customer/stores/[storeId]` route.
- `/customer/cart` reuses `CustomerCurrentOrder`, quantity mutation API, store fulfillment settings and checkout. The cart has an explicit remove-item control and a navigation quantity badge.
- `/customer/orders` displays submitted active orders and existing history, with existing detail/confirmation/cancel flows. Legacy `?view=current` redirects to Cart. Confirmed orders count as active.
- `/customer/alerts` uses existing customer-owned order events and collection deadlines. Duplicate created/placed events are combined. Where a matching status event is absent, it explicitly labels the order's current status and original order time. No fabricated notifications, inbox tables, read-state or push delivery were introduced.
- `/customer/addresses` reuses saved addresses, validation, RLS and the original add action. Separate card, form and native confirmation-dialog components support editing, deletion and default selection. Editing clears stale coordinates. Existing order address snapshots remain untouched.
- `/customer` and `/customer/stores` redirect to Shop. `/customer/profile/addresses` redirects to Addresses. Login, access-decision and email callbacks default to Shop. Dynamic storefront/order URLs remain stable.
- Profile remains accessible through the account icon. Identity, consent, privacy, notification preferences, support and logout remain available. Saved stores and favourite APIs/data remain usable as secondary features.

## Database change

`supabase/migrations/20261003084933_customer_default_address.sql` adds only an atomic default-selection function. It runs as SECURITY INVOKER, uses auth.uid(), serializes concurrent selections, honors existing RLS and rejects unavailable addresses. No tables, columns, policies, customers or historical orders were removed. The migration is installed on isolated staging (jezbvjepxosphdrykrcg), with its recorded version matched locally. Production was not changed.

An authenticated transaction test switched defaults, rejected an invalid target and verified exactly one default, then rolled back all fixtures. Catalog inspection confirmed anonymous callers cannot execute it, authenticated callers can, and SECURITY DEFINER is disabled. The new function produced no security-advisor finding. Existing findings concern other staff functions and auth settings; those remain outside this customer refactor.

## Cleanup decisions

Removed the obsolete primary navigation configuration, floating cart-to-Orders link, old Home rendering and duplicate profile-address rendering. Their replacements are redirects or shared components. Repository reference searches confirmed shared product/filter components, favourites, profile actions, QR registration, cart APIs and order services remain required or reusable; none were deleted. Pre-existing uncommitted work in manager/receptionist and other checkouts was retained.

## Verification

- Full Vitest run with two workers: 50 files, 287 tests passed (includes manager, receptionist, authorization and store isolation).
- Repository-wide ESLint passed. Final production build and its TypeScript checks passed, including all customer, manager and receptionist routes.
- Forward migration validation passed for 60 migrations.
- Live browser direct-URL, refresh, active-tab and mobile-width checks passed for all five areas, with no browser exceptions.
- Address add/edit/default/refresh/delete passed using the staging account marked is_test_account; temporary addresses were removed and the prior default restored.
- Configured password credentials do not match the staging test account. Browser verification used a temporary authenticated test-only session without sending email. Password entry itself is not claimed as verified.
- Screenshots and machine-readable results are in ignored `tmp/customer-refactor-verification/`. The reusable local verification script is `tests/local/customer-flow.mjs`; full mutation checks require `GREENCHOICE_CUSTOMER_FULL_FLOW=true` and refuse any environment that fails the existing staging-isolation verifier.

### Live order flow completed

The marked staging test customer browsed a registered store's Accessories/Lighters inventory, added a product via the existing product card, increased/decreased quantity in Cart, completed collection checkout with payment on fulfillment, and reached the existing confirmation route. Database checks confirmed the created order's customer_id and store_id. The order was visible in Active Orders and Alerts; its alert opened existing order details. UI cancellation succeeded, the order appeared in cancelled history, original historical order IDs remained present, and inventory quantity returned to its starting value. The test left the cart empty. No payment was charged and no production data was involved.

The customer access-decision endpoint returned /customer/shop for the authenticated test session. Screenshots were inspected at 390px width. Development badge interference and first-route compilation delays were handled only in the test harness; application UI and manager/receptionist settings were not altered for those test conditions.

The Supabase documentation used for the filtered update behavior is https://supabase.com/docs/reference/javascript/update. Existing security-advisor findings are documented at https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable (other staff functions), https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy (existing backend tables), and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection (existing Auth configuration). They do not concern the new invoker function and were not changed in this refactor.
