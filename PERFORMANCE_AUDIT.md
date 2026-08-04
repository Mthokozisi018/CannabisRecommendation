# GreenChoice Performance Audit

## Summary

The app builds successfully, but several development and runtime paths are doing more work than they need to. The biggest likely causes are:

1. The root layout renders `TopBar` globally, and `TopBar` performs Supabase staff/store lookups even on routes where `TopBarVisibility` later hides it on the client, including `/login`, manager dashboard routes, and receptionist routes.
2. The proxy/middleware matcher currently runs for almost every URL except `_next/static`, `_next/image`, and `favicon.ico`, so public assets such as `/images/...` and `/placeholder-images/...` still pass through proxy logic.
3. Dashboard auth/profile checks are repeated across proxy, layouts, pages, and data functions in the same request.
4. Receptionist POS and manager forms are large client modules that mix multiple responsibilities and can force broad re-renders or large client bundles.
5. Product/store/inventory data is often fetched in full and filtered in JavaScript after the query.
6. `public/` contains about 108 MB of raster/static assets, including multiple 1.7-2.1 MB PNG placeholders and design reference images.

I did not refactor code, change database schema, change policies, alter data, install packages, or change app behavior.

## Measured Results

### Commands Run

```powershell
Get-Content C:\Users\MthokozisiP\.codex\attachments\8482ee05-5b21-4fb1-931a-f9598e701d69\pasted-text.txt
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'next dev|next-server|node.*next' }
Get-Content package.json
Get-Content next-dev.out.log -Tail 220
Get-Content next-dev.err.log -Tail 180
rg --files app components lib -g '*.ts' -g '*.tsx'
rg -n 'use client' app components lib -g '*.ts' -g '*.tsx'
rg -n '\.select\(' app components lib -g '*.ts' -g '*.tsx'
rg -n 'select\(\s*["'']\*' app components lib scripts -g '*.ts' -g '*.tsx' -g '*.js' -g '*.mjs'
Get-ChildItem public -Recurse -File
npm run build
```

I did not start a second `npm run dev` process because a dev server was already running on port `3001` with `next dev --hostname 0.0.0.0 --port 3001`. I inspected the active dev logs instead.

### Dev Server Observations

The active dev log contained `962` route timing samples. Slowest observed routes:

| Route | Samples | Average | Max |
| --- | ---: | ---: | ---: |
| `/login` | 435 | 13.9s | 112.0s |
| `/dashboard/manager/inventory` | 42 | 9.3s | 92.0s |
| `/dashboard/manager` | 312 | 4.3s | 61.0s |
| `/dashboard/manager/products` | 10 | 5.8s | 31.6s |
| `/dashboard/manager/inventory/manage` | 12 | 5.7s | 19.2s |
| `/dashboard/manager/products/edit` | 6 | 6.1s | 16.7s |
| `/dashboard/admin/stores` | 1 | 6.8s | 6.8s |
| `/dashboard/receptionist` | 12 | 4.0s | 6.1s |

The dev error log also showed:

- Repeated Supabase `AuthApiError: Invalid Refresh Token: Refresh Token Not Found`.
- Repeated Supabase `AuthApiError: Invalid Refresh Token: Already Used`.
- `Insufficient staff role` errors from receptionist access paths.
- A hydration mismatch in `components/receptionist/ReceptionistPOS.tsx` caused by rendering `new Date()` during server/client rendering.

### Build Results

`npm run build` completed successfully.

- Next.js: `16.2.7` with Turbopack.
- Total measured command time: `38.5s`.
- Optimized production compile: `17.8s`.
- TypeScript step: `9.8s`.
- Static page generation: `13/13` in `616ms`.
- No build errors.

The current Next/Turbopack build output did not print the older "First Load JS" route-size table. I did not install a bundle analyzer because the request said not to install packages without approval.

Largest generated static chunks after build:

| Size | File |
| ---: | --- |
| 234 KB | `.next/static/chunks/0ayf-xlcwd66q.js` |
| 222 KB | `.next/static/chunks/2cya-h6pss2j9.js` |
| 110 KB | `.next/static/chunks/0cz1d0mv5g_q7.js` |
| 107 KB | `.next/static/chunks/0jyrkhzuo1ctf.js` |
| 72 KB | `.next/static/chunks/34g53n4klty4c.css` |

These chunk sizes are not catastrophic by themselves. The bigger issue appears to be repeated server-side work, broad client modules, large public images, and dev-server route churn.

## Biggest Performance Risks Found

1. **Global `TopBar` causes Supabase work on routes that hide it.**  
   `app/layout.tsx` wraps `<TopBar />` with `TopBarVisibility`, but `TopBarVisibility` is a client component. The server still prepares the `TopBar` child. `components/TopBar.tsx` calls `getCurrentStaff()` and `getCurrentStore()`, and `getCurrentStore()` calls `getCurrentStaff()` again. This likely explains why `/login` can be slow even though the visible login UI does not need staff/store data.

2. **Proxy matches public assets.**  
   `proxy.ts` excludes `_next/static`, `_next/image`, and `favicon.ico`, but not `/images/...`, `/placeholder-images/...`, `/legal/...`, or file extensions such as `.png`, `.jpg`, `.webp`, `.svg`, `.pdf`. Product grids and dashboards use many public assets, so asset requests still run through proxy cookie logic.

3. **Auth/profile checks repeat in the same request.**  
   Manager/receptionist routes can hit auth in `proxy.ts`, route layouts, page functions, and data helpers. Examples:
   - `proxy.ts` calls `supabase.auth.getUser()` and selects `staff_profiles`.
   - `app/dashboard/manager/layout.tsx` calls `requireUnrestrictedStaffRoute()` and `requireCompletedManagerOnboarding()`.
   - `app/dashboard/manager/page.tsx` calls `requireCompletedManagerOnboarding()` again.
   - `components/receptionist/ReceptionistPOSPage.tsx` calls both `listReceptionistCatalog()` and `getCurrentStaff()`, while `listReceptionistCatalog()` already calls `requireStaff()`.

4. **Receptionist POS is a single large client component.**  
   `components/receptionist/ReceptionistPOS.tsx` is `529` lines and handles filters, product grid rendering, cart state, checkout, product modal, badges, image selection, and live footer time. Cart changes and message changes re-render the same component that owns the product grid.

5. **Manager forms are bundled together in one large client module.**  
   `components/manager/ManagerForms.tsx` is `389` lines and exports multiple forms/panels. Routes that need only `AddProductForm`, `ManageInventoryForm`, `EditProductCardsForm`, `ViewInventoryPanel`, or staff forms import from the same `"use client"` module, which can increase client bundle and hot reload scope.

6. **Large data sets are fetched before filters are applied.**  
   Receptionist catalog and manager inventory/product pages fetch all relevant rows for the store and then filter in JavaScript. This is safe functionally, but it will slow down as product counts grow.

7. **Image payload is large.**  
   `public/` contains `108.52 MB` total; raster assets alone are `108.09 MB`. Several placeholders/backgrounds are around 2 MB each, and `public/design-references` contains `27.16 MB` that appears to be non-runtime reference material.

## Slow Compile Time Causes

- Large client modules cause broad rebuilds when edited:
  - `components/receptionist/ReceptionistPOS.tsx`: `529` lines.
  - `components/manager/ManagerForms.tsx`: `389` lines.
  - `components/manager/ManagerOnboarding.tsx`: `370` lines.
  - `app/login/LoginForm.tsx`: `227` lines.
- `components/manager/ManagerForms.tsx` is imported by many manager pages. Editing one form can invalidate routes for add product, edit product, add stock, view inventory, staff creation, and staff password reset.
- `components/GreenChoiceDashboard.tsx` is a shared file for dashboard UI, money formatting, image panels, and back links. Many routes import it, so changes there have a wide blast radius.
- `public/` includes large runtime and design-reference images. Public assets are not bundled as JS, but they are watched and served by the dev server.
- Almost all dashboard pages are `force-dynamic`, which is appropriate for auth-sensitive pages, but it means request-time work happens frequently during development.

Largest inspected source files:

| Lines | File |
| ---: | --- |
| 529 | `components/receptionist/ReceptionistPOS.tsx` |
| 527 | `app/dashboard/admin/actions.ts` |
| 389 | `components/manager/ManagerForms.tsx` |
| 370 | `components/manager/ManagerOnboarding.tsx` |
| 356 | `app/dashboard/manager/actions.ts` |
| 227 | `app/login/LoginForm.tsx` |
| 221 | `lib/receptionist/products.ts` |
| 220 | `lib/manager/onboarding.ts` |
| 218 | `lib/dal/carts.ts` |
| 214 | `lib/types.ts` |

## Slow Runtime/Page Render Causes

- `TopBar` staff/store lookups run globally from `app/layout.tsx`, including routes that hide the top bar.
- `getCurrentStaff()` is not request-memoized. The same request can call it through top bar, dashboard guards, page functions, and data helpers.
- `proxy.ts` performs Supabase auth/profile checks for manager/receptionist routes before the route layout performs similar checks again.
- `app/dashboard/admin/page.tsx` runs `getAdminStats()` and then writes an audit row through `logAdminAudit("admin_logged_in", ...)` on every admin dashboard render.
- `getAdminStores()` fetches all stores plus all manager/receptionist profiles and maps them in JavaScript.
- `getStoreAccessRows()` simply returns `getAdminStores()`, so `/dashboard/admin/payments` fetches staff/member details it does not display.
- `listReceptionistCatalog()` fetches all active products for the store with inventory stock, derives categories in JavaScript, and then the client filters again after category/subcategory/cultivation selection.
- `listManagerProducts()` fetches full product details plus inventory relation for add stock, edit product, and view inventory pages.
- The receptionist POS footer renders the current time with `new Date()`, causing hydration mismatch and client regeneration when server/client minutes differ.

## Supabase Query Concerns

### `select("*")`

No `select("*")` usage was found in `app`, `components`, `lib`, or `scripts` with the audit search. Most queries use explicit column lists, which is good.

### Heavy Or Over-Broad Fetches

- `lib/admin/data.ts`
  - `getAdminStats()` uses count-only head queries in parallel. This is good.
  - `getAdminStores()` fetches all stores and all manager/receptionist staff profiles, then filters members per store in JavaScript.
  - `getStoreAccessRows()` reuses `getAdminStores()`, so the payments page over-fetches manager/receptionist details.

- `lib/receptionist/products.ts`
  - `listReceptionistCatalog()` fetches all active products for a store with related `inventory_stock`.
  - It derives categories from all products and filters by optional params in JavaScript.
  - `ReceptionistPOS` then performs category, subcategory, and cultivation filtering in the browser.

- `lib/manager/data.ts`
  - `listManagerProducts()` fetches all non-deleted products for the manager store plus inventory stock.
  - `app/dashboard/manager/inventory/manage/page.tsx`, `inventory/view/page.tsx`, and `products/edit/page.tsx` all use this broad list.

### Repeated Query Patterns

- `ReceptionistPOSPage` duplicates staff reads by calling `listReceptionistCatalog()` and `getCurrentStaff()` separately.
- Manager dashboard layout and page duplicate onboarding/profile checks.
- `TopBar` calls both `getCurrentStaff()` and `getCurrentStore()`, and `getCurrentStore()` calls `getCurrentStaff()` again.
- Admin dashboard stats and audit logging each verify admin user separately.

## Client Component Concerns

The project has `13` `"use client"` files in `app`, `components`, and `lib`.

Largest client files:

| Lines | File |
| ---: | --- |
| 529 | `components/receptionist/ReceptionistPOS.tsx` |
| 389 | `components/manager/ManagerForms.tsx` |
| 370 | `components/manager/ManagerOnboarding.tsx` |
| 227 | `app/login/LoginForm.tsx` |
| 119 | `components/admin/DeleteStoreButton.tsx` |

Important notes:

- Dashboard `page.tsx` files are mostly server components, which is good.
- The heavy interactivity is concentrated in a few very large client modules.
- `ManagerForms.tsx` should likely be split later by route/action so each page imports only the form it needs.
- `ReceptionistPOS.tsx` should likely be split later into stable child components so cart updates do not force the entire product browsing UI to re-render.
- `TopBarVisibility` is client-side route gating around a server `TopBar`; that hides UI but does not avoid the server work.
- `NavigationLoadingOverlay` is mounted globally in `app/layout.tsx`. It is small, but it adds client code to every route.

## Image/Asset Concerns

### Asset Size

Measured public assets:

- `public` total: `108.52 MB`.
- Raster assets: `71` files, `108.09 MB`.
- `public/design-references`: `17` files, `27.16 MB`.
- `public/images`: `42` files, `62.28 MB`.
- `public/placeholder-images`: `13` files, `18.65 MB`.

Largest assets:

| Size | File |
| ---: | --- |
| 2142.9 KB | `public/images/greenchoice-loading.png` |
| 2140.8 KB | `public/images/flower-placeholders/outdoor.png` |
| 2078.6 KB | `public/placeholder-images/rolling paper.png` |
| 2053.6 KB | `public/design-references/receptionist-dashboard/...Flowers(Different Vaiations).png` |
| 2053.6 KB | `public/images/receptionist/flowers-variations.png` |
| 2024.1 KB | `public/images/flower-placeholders/greenhouse.png` |
| 1932.7 KB | `public/placeholder-images/backed Goods.png` |
| 1904.4 KB | `public/images/receptionist/concentrates.png` |
| 1888.3 KB | `public/images/receptionist/oil.png` |
| 1763.8 KB | `public/images/flower-placeholders/indoor.png` |
| 1730.4 KB | `public/images/admin-dashboard-wallpaper.png` |
| 1730.4 KB | `public/images/backgrounds/greenchoice-manager-dashboard-wallpaper.png` |

### Image Rendering

Normal `<img>` usage was found in:

- `components/manager/ManagerForms.tsx`: 4 occurrences.
- `components/receptionist/ReceptionistPOS.tsx`: 2 occurrences.
- `components/ProductImage.tsx`: 1 occurrence.
- `components/GreenChoiceDashboard.tsx`: 1 occurrence.

Some of this is intentional because product images can be Supabase URLs or blob previews. Still, later improvements should consider:

- Compressing large PNG placeholders or converting to WebP/AVIF.
- Moving non-runtime design reference images out of `public`.
- Adding width/height or stable sizes for normal `<img>` elements where possible.
- Using `next/image` for local images and configured remote Supabase images where possible.
- Ensuring public images do not pass through `proxy.ts`.

## Page-by-Page Notes

### Login

Evidence:

- `/login` had the most slow dev samples: `435` samples, `13.9s` average, `112s` max.
- `app/login/page.tsx` itself is mostly visual markup plus `LoginForm`.
- The root layout renders `TopBar`, and `TopBar` performs staff/store lookups before `TopBarVisibility` hides it on `/login`.
- Dev errors show repeated invalid refresh token errors.

Likely safe future fix:

- Move top bar rendering into route groups or make the route decision server-side, so `/login` never computes `TopBar`.
- Investigate stale Supabase auth cookies causing refresh-token churn.
- Keep the visible login/auth behavior unchanged.

### Admin Dashboard

Evidence:

- `app/dashboard/admin/page.tsx` calls `getAdminStats()` and then writes an audit log row on every render.
- `getAdminStats()` itself is efficient because it uses count-only head queries in parallel.
- The admin layout uses a large CSS background image: `public/images/admin-dashboard-wallpaper.png` at about `1.7 MB`.

Likely safe future fix:

- Keep count queries, but consider whether `admin_logged_in` should be logged only on actual login/session start instead of every page render.
- Compress the admin wallpaper.

### View Stores & Managers

Evidence:

- `app/dashboard/admin/stores/page.tsx` loads `getAdminStores()`.
- `getAdminStores()` fetches all stores and all manager/receptionist staff profiles immediately.
- The page renders expandable details for every store in the initial response.

Likely safe future fix:

- Keep the main table/counts on initial load.
- Lazy-load expanded store member details only when a store row is opened.
- Keep delete behavior server-side and admin-guarded.

### Payments & Subscriptions

Evidence:

- `app/dashboard/admin/payments/page.tsx` calls `getStoreAccessRows()`.
- `getStoreAccessRows()` returns `getAdminStores()`, which fetches staff member details that the payments page does not display.

Likely safe future fix:

- Add a separate store-access query that selects only `id`, `name`, address fields, and `store_access_status`.

### Manager Dashboard

Evidence:

- `/dashboard/manager` had `312` timing samples, `4.3s` average, `61s` max.
- `proxy.ts` checks auth/profile before route load.
- `app/dashboard/manager/layout.tsx` calls both `requireUnrestrictedStaffRoute()` and `requireCompletedManagerOnboarding()`.
- `app/dashboard/manager/page.tsx` calls `requireCompletedManagerOnboarding()` again.
- The root `TopBar` work likely also happens even though `TopBarVisibility` hides it for manager routes.

Likely safe future fix:

- Request-memoize staff/profile reads.
- Avoid duplicate onboarding checks between layout and page.
- Avoid global top bar work for manager dashboard routes.

### Manage Products

Evidence:

- Add Product imports `AddProductForm` from the large `ManagerForms.tsx` client module.
- Edit Product calls `listManagerProducts()` and then filters products client-side.
- Product image previews use normal `<img>` for blob/local/Supabase compatibility.

Likely safe future fix:

- Split `ManagerForms.tsx` into separate client modules by form.
- Keep uploaded-image behavior unchanged.
- Fetch narrower product lists for edit selectors if product counts grow.

### Manage Inventory

Evidence:

- `/dashboard/manager/inventory` had `42` timing samples, `9.3s` average, `92s` max.
- Add Stock, View Inventory, and Edit Product each call `listManagerProducts()`.
- `listManagerProducts()` selects full product details plus inventory stock.
- Filtering/selecting products happens in client components.

Likely safe future fix:

- Create narrower data functions for:
  - add-stock selector rows,
  - inventory table rows,
  - edit-product rows.
- Add server-side category/subcategory/cultivation filters later if product counts grow.

### Receptionist Dashboard

Evidence:

- `components/receptionist/ReceptionistPOS.tsx` is the largest client component at `529` lines.
- `listReceptionistCatalog()` fetches all active products for the store before the receptionist selects filters.
- Category, subcategory, and cultivation filtering happens in the browser.
- Cart state, selected product modal state, checkout state, filter state, and product grid rendering are in one component.
- Adding to cart updates parent state and re-renders the component that owns the product grid.
- Product cards use normal `<img>` and can render large local placeholder images.
- Footer time uses `new Date()` and caused a hydration mismatch in the dev log.

Likely safe future fix:

- Split into `FilterPanel`, `ProductGrid`, `ProductCard`, `CartPanel`, and `ProductDescriptionModal`.
- Memoize product cards after splitting.
- Move footer clock to client-only state/effect or render a stable server value.
- Consider server-side filtering only after preserving current UX.

### Checkout/POS

Evidence:

- Checkout uses a server action that validates input and calls the `complete_receptionist_sale` RPC. That is good because critical checkout logic stays server-side.
- The UI checkout state lives inside `ReceptionistPOS`, so checkout state changes can re-render product browsing UI.

Likely safe future fix:

- Keep the RPC and server action unchanged.
- Isolate checkout/cart UI into a child client component once POS is split.

## Recommended Refactor Approach

### Stage 1: Low-Risk Cleanup

1. Move `TopBar` out of the global root layout path for `/login`, manager dashboard routes, and receptionist routes, or make the visibility decision server-side with route groups.
2. Tighten `proxy.ts` matcher so public static assets and file extensions do not run through proxy logic.
3. Fix the POS footer hydration mismatch by avoiding server/client `new Date()` text mismatch.
4. Request-memoize `getCurrentStaff()` and related profile/store reads for the duration of a server render.

### Stage 2: Component Splitting

1. Split `components/manager/ManagerForms.tsx` into route-specific client modules:
   - `AddProductForm`
   - `EditProductCardsForm`
   - `ManageInventoryForm`
   - `ViewInventoryPanel`
   - staff account forms
2. Split `components/receptionist/ReceptionistPOS.tsx` into:
   - `FilterPanel`
   - `ProductGrid`
   - `ProductCard`
   - `CartPanel`
   - `ProductDescriptionModal`
   - small image/badge helpers
3. Keep all props and behavior stable during the split.

### Stage 3: Query Optimization

1. Add separate admin query for payments that does not fetch managers/staff.
2. Lazy-load store member detail rows on `/dashboard/admin/stores`.
3. Add narrower manager product queries for add-stock, edit-product, and inventory-table needs.
4. Only move receptionist filters into Supabase once UI behavior is preserved and product count makes it necessary.

### Stage 4: Client/Server Component Separation

1. Keep page-level auth guards server-side.
2. Keep critical checkout/inventory/admin delete actions server-side.
3. Push only interactive controls into client components.
4. Avoid wrapping server components with client visibility components when the server work is not needed.

### Stage 5: Image Optimization

1. Compress or convert large PNG placeholders/backgrounds.
2. Move `public/design-references` outside runtime `public` if those files are not needed by the app.
3. Configure `next/image` for safe local images and approved Supabase image domains.
4. Add stable image dimensions/loading behavior for product cards.

### Stage 6: Rendering Optimization

1. Memoize product cards after POS is split.
2. Keep cart state local to `CartPanel` where possible.
3. Consider virtualization only if product grids become very large.
4. Add route-level loading states for admin/manager pages that perform slow server work.

## What Not To Touch Yet

- Do not change Supabase schema or migrations.
- Do not change RLS policies.
- Do not change auth behavior, role logic, onboarding, or store isolation.
- Do not change checkout RPC behavior or inventory calculations.
- Do not change admin delete-store behavior without separate testing.
- Do not remove audit logging without deciding the security requirement first.
- Do not replace all `<img>` tags blindly; blob previews and Supabase URLs need careful handling.
- Do not remove `force-dynamic` from protected pages without proving auth/session correctness.

## Questions For Me

1. How many products per store should GreenChoice support comfortably: tens, hundreds, or thousands?
2. Should `public/design-references` be kept in the shipped app, or can those images move outside `public`?
3. Should admin dashboard page views be written to `audit_logs`, or should only real admin actions/login events be logged?
4. Is it acceptable to route-group the app so `/login`, admin, manager, and receptionist dashboards each get their own layout?
5. Do you want image optimization to preserve PNG format, or are WebP/AVIF placeholders acceptable?

## Recommended First Fixes

The safest first fixes are:

1. Stop global `TopBar` server work from running on `/login` and dashboard routes that hide it.
2. Exclude public static assets from `proxy.ts`.
3. Fix the `ReceptionistPOS` timestamp hydration mismatch.
4. Split `ManagerForms.tsx` into smaller client modules.
5. Split `ReceptionistPOS.tsx` into smaller components without changing behavior.

These are high-impact and do not require database, RLS, checkout, inventory, onboarding, or auth policy changes.
