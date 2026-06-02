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

Local preview mode works without Supabase credentials and uses:

- Email: `admin@greenchoice.local`
- Password: `GreenChoiceLocal123!`

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
