# Phase 5 deployment plan — prepared, not executed

## Gate 0: release candidate

1. Resolve the outstanding Phase 4 blockers in the migration, identification-encryption and recovery reports. Obtain read-only authoritative migration histories and a sanitized schema comparison for both Supabase projects. Rehearse the exact ordered forward sequence on an isolated copy, including the two billing-version conflicts and the new document bucket migration.
2. Review the entire working tree. It contains extensive pre-existing modified, deleted and untracked work; do not treat the present `HEAD` as a release candidate. Exclude `artifacts/`, temporary test assets, database exports, credentials and local `.env*` files. Review the diff and commit only intended source, migrations, tests and documentation. Record the resulting **exact commit SHA** and dependency lockfile hash. There is no approved release commit yet.
3. Run the complete local validation suite, POS PostgreSQL checks, isolated browser suites, relevant end-to-end tests and production build at that exact commit. Verify the staging target project and branch mapping before any push or deployment-triggering action. Keep Pending Orders disabled in production; verify its effective Vercel environment value and the production smoke test.

## Gate 1: environment and backup configuration

- **Vercel:** confirm separate staging and production project/environment bindings, `GREENCHOICE_ENV`, correct app origins, `ALLOWED_ORIGINS`, readiness secret, error monitoring, distributed rate limiting and `GREENCHOICE_PENDING_ORDERS_ENABLED` for production. Review all public versus server-only variable names without printing secret values.
- **Supabase:** confirm distinct project refs and credentials, Auth redirects/email policy, storage bucket privacy, RLS and service-role use, authoritative migration history, backups/PITR, retention and an independent Storage-object backup. Capture a recoverable pre-migration point.
- **Paystack:** keep `PAYSTACK_MODE=test` and a server-only `sk_test_` credential in staging. After a real HTTPS staging origin exists, set `PAYSTACK_CALLBACK_URL` to `<verified-origin>/billing/payment/callback` and `PAYSTACK_WEBHOOK_URL` to `<verified-origin>/api/payments/paystack/webhook`; configure the same webhook in Paystack Test Mode. Current public staging origin is not verified, so these are templates, not live URLs.
- **Identification:** provision `CUSTOMER_DOCUMENT_ENCRYPTION_KEY` as an independent managed 32-byte key, with custody, backup and recovery test. Keep the HMAC key separate. Apply the additive Storage bucket migration before activating encrypted uploads.
- **Operations:** verify Redis endpoint/token and Sentry alert delivery, health checks, backup jobs and incident contacts. The proposed RPO/RTO in the recovery runbook require owner approval and a measured drill.

## Gate 2: authorized staging deployment and verification

1. Obtain explicit deployment authorization. Apply only reviewed staging migrations after verified backup and isolated rehearsal. Never replay both versions of either billing migration; use a documented history repair only if catalog evidence proves it necessary.
2. Deploy the approved SHA to the verified staging target. Check build, deployment URL, route responses, environment guard and database compatibility.
3. Execute authenticated manager, receptionist, franchise and customer journeys with distinct Store A/B and Franchise A/B accounts. Test database and API tenant denials, role restrictions, ID upload encryption, cleanup, password setup/reset and session expiry.
4. Execute Paystack Test Mode checkout and webhook tests through the hosted public routes: initial success/failure, amount mismatch, forged/duplicate callbacks and webhooks, monthly renewal/failure, reconciliation, expiry and grace. Reconcile provider records with billing rows.
5. Confirm health, monitoring alerts, concurrent POS/inventory writes, payment idempotency, and an isolated database plus Storage restore. Record actual RPO/RTO and any missing objects. Repeat full local checks against the deployed SHA if changed.

## Gate 3: production readiness review

Review staging evidence, exact SQL and migration history, backup/restore evidence, encryption coverage, Paystack production approval and live-mode design, feature flags, rollback compatibility, monitoring ownership and remaining risks. A successful staging test does not authorize production. Obtain **separate explicit production deployment and migration authorization** before any production action; never automatically promote staging.
