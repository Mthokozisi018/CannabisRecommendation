# GreenChoice Dispensary Workstation

Effect-first staff workstation MVP for in-store cannabis product recommendations. It stops at recommendation, browsing, product detail, draft cart, and saved draft cart review. There is no payment, checkout, delivery, order, refund, or POS settlement code.

## Stack

- Next.js App Router with TypeScript and Tailwind CSS
- Supabase-ready Postgres/Auth/Storage schema in `supabase/migrations`
- Server-only DAL modules under `lib/dal`
- Server Actions and a CSRF-protected sample Route Handler for mutations
- Deterministic recommendation scoring in `lib/services/recommendation.ts`

## Local Run

```bash
cd greenchoice-workstation
npm install
npm run dev
```

Open `http://127.0.0.1:3001`.

For the Django-backed GreenChoice MVP manager login, run the backend seed first from the repository root:

```bash
python manage.py migrate
python manage.py seed_greenchoice_staff
python manage.py seed_greenchoice_demo
python manage.py runserver
```

Then log in at `/login` with:

- Email: `manager@greenchoice.local`
- Password: `ChangeMe123!`
- Role: `MANAGER`

Receptionist test login:

- Email: `receptionist@greenchoice.local`
- Password: `ChangeMe123!`
- Role: `RECEPTIONIST`

These credentials are only for development/testing. Change the password before using the system in production.

The frontend posts staff credentials to `GREENCHOICE_API_BASE_URL`, defaulting to `http://127.0.0.1:8000/api/v2`.

Dashboard routes:

- `/dashboard/manager`
- `/dashboard/manager/products`
- `/dashboard/manager/products/new`
- `/dashboard/manager/products/category/[slug]`
- `/dashboard/manager/inventory`
- `/dashboard/manager/sales`
- `/dashboard/manager/staff`
- `/dashboard/manager/low-stock`
- `/dashboard/manager/promotions`
- `/dashboard/manager/categories`
- `/dashboard/receptionist`
- `/dashboard/receptionist/products`
- `/dashboard/receptionist/customers/register`
- `/dashboard/receptionist/checkout`

## Supabase Setup

Create a Supabase project, run `supabase/migrations/20260602160000_greenchoice_mvp.sql`, create a staff user in Supabase Auth, then add a matching `profiles` row and `store_memberships` row. Copy `.env.example` to `.env.local` and set:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
APP_URL=http://127.0.0.1:3001
CSRF_SECRET=
STORAGE_BUCKET_PRODUCTS=products
```

Legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are also supported.

## Architecture Notes

The UI layer calls typed DAL functions and receives DTOs only. Mutations re-check staff auth and role authorization inside the action/handler. Store scope is represented now by the seeded `GreenChoice Sandton` store and enforced in DAL queries; the SQL RLS policies enforce membership-based access for multi-store production use.

Recommendation scoring is deterministic:

- 55% selected effect score
- 15% terpene affinity proxy
- 10% THC/CBD range fit
- 10% rating normalization
- 10% stock/freshness bonus

Effect, benefit, terpene, and flavor labels are informational product tags, not medical claims.

## QA Flow

1. Visit `/`.
2. Select an effect card.
3. Browse ranked products at `/browse`.
4. Use category tabs and filters.
5. Open Gelato #33 or another product detail page.
6. Add items to the draft cart.
7. Save the draft cart and reopen it from `/carts/[id]`.

Admin QA routes:

- `/admin/products`
- `/admin/import`
