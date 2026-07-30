# GreenChoice Workstation

Next.js staff application for GreenChoice, backed by Supabase.

## Local Run

Use Node `24.x` and npm `11.x`.

```bash
npm ci
npm run dev
```

Open `http://127.0.0.1:3001/login`.

Create `.env.local` from `.env.example` and supply credentials for a dedicated
local or development Supabase project. Development, staging, and production
must use separate Supabase projects.

## Environment Safety

- `GREENCHOICE_ENV` must identify `development`, `staging`, or `production`.
- `APP_URL`, invite redirects, and password-recovery redirects are
  environment-specific. Production URLs must use HTTPS.
- Preview deployments must use staging/preview Supabase credentials and must
  never inherit production secrets.
- Service-role and secret keys are server-only. Never prefix them with
  `NEXT_PUBLIC_`.
- The production rate limiter requires its Redis REST URL and token.
- `.env.example` contains names and placeholders only.

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
- `/staff/invitation/onboarding`
