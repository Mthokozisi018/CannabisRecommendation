# GreenChoice environment isolation

All development and deployment source lives in `greenchoice-workstation` and uses the existing GitHub repository. Staging and production infrastructure have separate credentials and database identities.

## Local development

1. Use Node 24 and npm 11.
2. Populate the ignored `.env.staging.local` from `.env.staging.example`.
3. Run `npm run verify:local-env`, then `npm run dev`.
4. Open `http://127.0.0.1:3001/login`.

The runner sets the local origin and enables customer ordering and pending orders. It verifies that the Supabase project matches `EXPECTED_SUPABASE_PROJECT_REF` and differs from `PRODUCTION_SUPABASE_PROJECT_REF`. It disables admin bootstrap and destructive seeds. Existing `.env.local` is preserved; no other project folder supplies configuration.

## Staging build and deployment

`npm run verify:staging-env` requires a canonical HTTPS staging origin, independent signing secrets, a readiness secret, and distributed Redis rate limiting. `npm run build:staging` builds the production application using that configuration. For Vercel Preview, use `GREENCHOICE_ENV=staging` and the isolated staging Supabase identity.

For Vercel Production, use `GREENCHOICE_ENV=production`, the designated production Supabase identity, HTTPS application origins, signing secrets, and distributed rate limiting. `instrumentation.ts` validates these at runtime. `READINESS_DIAGNOSTIC_SECRET` protects the database-aware readiness endpoint; it must contain at least 32 random characters.

## Database migrations

The migration directory includes reconciled production history and preserves newer POS payments, supplier metadata, search outbox, customer addresses, and order flows. Review migration history against each target before applying pending migrations. Local validation does not apply migrations to a remote database. The consolidated security migration revokes obsolete sale entry points and preserves the test-account index without modifying previously applied migrations.

## Verification

Run `npm run lint`, `npm run typecheck`, `npm run validate:migrations`, `npm run scan:secrets`, `npm run test`, `npm run audit:production`, and `npm run build:staging`. Run `npm run test:e2e` against the local application. Credential-dependent E2E tests need the corresponding `E2E_*` variables; skipped tests are reported separately.

Never commit credentials, copy production business data into staging, or expose server secrets through `NEXT_PUBLIC_*`. The existing production Vercel link remains the canonical deployment destination.
