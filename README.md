# GreenChoice Workstation

Next.js staff application for GreenChoice, backed by Supabase.

## Local Run

Use Node `24.x` and npm `11.x`.

```bash
npm ci
npm run dev
```

Open `http://127.0.0.1:3001/login`.

Create the ignored `.env.staging.local` from `.env.staging.example` and supply
credentials for a staging Supabase project isolated from production. The local
runner verifies its identity, enables customer ordering and pending orders, and
sets the application origin to `http://127.0.0.1:3001`. Existing `.env.local` is
preserved; the staging runner overrides its database settings without reading
another project folder.

Use `npm run build:staging` for a production build with the verified HTTPS staging
configuration. Deployments use `npm run build` with their own environment settings.
Never copy local credentials into deployment configuration or source control.

## Environment Safety

- `GREENCHOICE_ENV` must identify `development`, `staging`, or `production`.
- `APP_URL`, invite redirects, and password-recovery redirects are
  environment-specific. Production URLs must use HTTPS.
- Preview deployments must use staging/preview Supabase credentials and must
  never inherit production secrets.
- Service-role and secret keys are server-only. Never prefix them with
  `NEXT_PUBLIC_`.
- The production rate limiter requires its Redis REST URL and token.
- `READINESS_DIAGNOSTIC_SECRET` protects `/api/health/readiness` with a Bearer token
  of at least 32 characters. The endpoint returns only readiness status.
- `GREENCHOICE_CACHE_REDIS_TIMEOUT_MS` optionally bounds cache requests; default
  750 ms, allowed range 100–2000 ms. Cache failures fall back to Supabase.
- `.env.example` contains names and placeholders only.

## Local POS Customer Search

The receptionist checkout searches store-scoped `pos_customers` through Elasticsearch when
`ELASTICSEARCH_URL` is set. Supabase remains the source of truth. Search results are checked
against current Supabase rows by ID before they are returned, so moved or deleted records
cannot appear from a stale index. Without Elasticsearch, the existing Supabase search works.

For a local-only Elasticsearch node, install Docker Desktop and run:

```powershell
docker run --name greenchoice-elasticsearch -d -p 127.0.0.1:9200:9200 -e discovery.type=single-node -e xpack.security.enabled=false -e ES_JAVA_OPTS="-Xms512m -Xmx512m" docker.elastic.co/elasticsearch/elasticsearch:9.5.4
```

This local node has authentication disabled and is bound to loopback only. Set
`ELASTICSEARCH_URL=http://127.0.0.1:9200` in the local staging environment file.
`ELASTICSEARCH_API_KEY` is optional for this local node; use an API key and HTTPS
with a secured Elasticsearch or Elastic Cloud deployment. Do not use a public URL
for an unsecured node.

Apply `supabase/migrations/20261001120000_pos_customer_search_outbox.sql` to the
staging Supabase project before indexing. It queues inserts, updates, soft deletes,
and hard deletes. Then run from this directory:

```powershell
node scripts/sync-pos-customer-search.mjs --reindex
node scripts/sync-pos-customer-search.mjs --watch
```

The worker reads the same verified staging environment file as `npm run dev`.
Set `GREENCHOICE_STAGING_ENV_FILE` if it is elsewhere. `--reindex` queues every
existing POS customer and bulk indexes in batches of 100 using the customer UUID
as the Elasticsearch document ID. Re-running it is safe. Keep `--watch` running in
staging to apply queued changes every ten seconds; failures remain queued for retry.
Receptionist registrations also index immediately when Elasticsearch is available.
The search endpoint is `POST /api/dashboard/receptionist/customers/search` with
`{ "mode": "name" | "phone", "query": "..." }`; it gets the active store from the
authenticated staff session.

To test, sign in as a staging receptionist, open POS checkout, and search by a
customer's name, surname, full name, `079`, or a full cellphone number. Try a
customer in another store and confirm it is absent. The portal's `customer_profiles`
table currently has no store association; those self-registered accounts are not
POS customer records and are not indexed by this store-scoped search.

Any credential previously shared, committed, or used outside isolated local
development must be rotated in Supabase or its owning service. This repository
does not rewrite Git history automatically.

## Administrator Bootstrap

Administrator creation is not exposed through an application endpoint. The
only supported bootstrap is the explicit server-side script:

```bash
npm run seed:admin
```

It requires `ADMIN_EMAIL`, `ADMIN_INITIAL_PASSWORD`, and
`ALLOW_ADMIN_BOOTSTRAP=true`. Run it deliberately against the intended project,
then remove the bootstrap password from the environment and rotate it through
the normal recovery flow.

## Production Checks

```bash
npm run lint
npm run typecheck
npm test
npm run test:security
npm run build
npm audit --omit=dev
```

## Production Hosting

Use `.env.production.example` as the deployment checklist and create a real
`.env.production` only in your hosting provider or local secret store. A
production runtime intentionally fails to start unless these are set:

- `GREENCHOICE_ENV=production`
- `EXPECTED_SUPABASE_PROJECT_REF`
- HTTPS `APP_URL` and `NEXT_PUBLIC_APP_URL`
- production Supabase public and server credentials
- `CSRF_SECRET`, `SESSION_SIGNING_SECRET`, and `RATE_LIMIT_KEY_SECRET`
- `RATE_LIMIT_REDIS_REST_URL` and `RATE_LIMIT_REDIS_REST_TOKEN`

Docker builds are supported from this directory:

```bash
docker build -t greenchoice-workstation .
docker run --env-file .env.production -p 3001:3001 greenchoice-workstation
```

The production container exposes `/api/health` for liveness checks. The
authenticated readiness endpoint is `/api/health/readiness`.

## Vercel Frontend

Deploy only this directory, `greenchoice-workstation/`, as the Vercel project
root. The included `vercel.json` sets the Next.js framework and the install,
build, and dev commands.

Vercel project settings:

- Framework preset: `Next.js`
- Root directory: `greenchoice-workstation`
- Install command: `npm ci`
- Build command: `npm run build`
- Development command: `npm run dev`

Set the production environment variables from `.env.production.example` in
Vercel before deploying. Production deploys intentionally fail fast when the
required Supabase, Redis, URL, and secret values are missing.

CLI deployment after logging in:

```bash
npx vercel login
npx vercel link
npx vercel env pull .env.production.local
npx vercel --prod
```

Migrations are forward-only and are not automatically applied by application
deployments. Test them in a dedicated local or staging Supabase project before
an approved production migration window.

## Dashboard Routes

- `/login`
- `/dashboard/admin`
- `/dashboard/manager`
- `/dashboard/receptionist`
- `/manager/setup/account`
- `/manager/setup/store`
- `/staff/setup/account`
# Store QR registration

Managers can open **QR Code** on the dashboard to download, share or copy their
permanent store registration link. Customers complete one mobile form at
`/register/[token]`; successful document-number and age checks register the
customer in the existing store-scoped POS model.

The provider is **unconfigured by default** and registration fails closed. See
[the implementation and activation guide](docs/qr-registration.md) for the
migration, provider contract, required environment, notices and cleanup schedule.
