# Phase 4 commercial release gates — 24 October 2026

Status: **not ready for production deployment**. The production Vercel project and Supabase database were read only during this audit.

## Executed application evidence

- Hosted staging manager onboarding passed with a generated account: administrator-created credentials, temporary-password replacement, account and store setup, unpaid billing restriction, checkout initialization, cross-store read denial, and fixture cleanup. The checkout redirected to `checkout.paystack.com` and left a pending payment. The hosted automated browser encountered Paystack's Cloudflare security-verification page, so no charge, webhook activation, or renewal was verified. No billing record was artificially set active.
- Hosted anonymous checks passed for login redirects, store registration availability, account privacy restriction, and the retired staff-invitation route (3 passed, 1 credential-dependent test skipped).
- The optimized staging build, TypeScript check, and 812 Vitest cases passed after the billing-mode change and dependency update. `npm audit --omit=dev --audit-level=high` reports zero vulnerabilities after `undici` 7.30.1 and `zod` 4.6.7. Lint has one existing warning in `CustomerCheckout.tsx`.
- The staging deployment's inspected log window contained three error-level entries, all from an intentionally denied anonymous registration-QR request. No other error-level entry was returned in that window. `/api/health` returned HTTP 200 on staging and production. The diagnostic readiness endpoint returned 401 without its secret.

Hosted receptionist sales/refunds, customer order and security flows, franchise supply approvals/distribution, complete password-reset behavior, and an actual Paystack test payment are still unverified. Passing unit tests or page redirects do not close those gates.

## Production configuration

The existing Vercel production project is `greenchoice-workstation` (`prj_40Vgo6XgjD0GDMnmN6RWUUBOrLeE`). Its inspected environment inventory has 23 keys. It has no `PAYSTACK_BILLING_ENABLED`, `PAYSTACK_MODE`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_CALLBACK_URL`, or `PAYSTACK_WEBHOOK_URL`. It also lacks `GREENCHOICE_PASSWORD_FINGERPRINT_SECRET` and `READINESS_DIAGNOSTIC_SECRET`. `GREENCHOICE_CUSTOMER_EXPERIENCE_ENABLED`, `STORAGE_BUCKET_PRODUCTS`, and support contact settings are not present. These are key-name findings; secret values were not decrypted or printed. The public app origin, Supabase Auth redirect allowlist, and Paystack dashboard webhook configuration still need private value-level checks.

The release candidate now accepts `sk_test_` only with `GREENCHOICE_ENV=staging` and `PAYSTACK_MODE=test`, and `sk_live_` only with `GREENCHOICE_ENV=production` and `PAYSTACK_MODE=live`. Signed webhook verification, payment verification, renewal checks, and subscription creation use the configured mode. Production staff access fails closed if billing is missing or has mismatched credentials. Real live-mode credentials and Paystack dashboard activation have **not** been supplied or approved. No real transaction was initiated.

The last known production deployment is `dpl_2P1t5Tas8s3jgxtDHVGQtzkWZsSs` (`greenchoice-workstation-6gvhqaslz.vercel.app`), READY and aliased to `greenchoice-workstation.vercel.app`. Preserve this ID for application rollback. Rollback via Vercel changes the served application deployment; it does not reverse database migrations or restore uploaded files. No rollback was executed.

## Supabase recovery and security

The production Supabase organization reports `plan=free`, `tier=tier_free`; the project is `ACTIVE_HEALTHY` on Postgres 17.6.1.166. Supabase's [backup documentation](https://supabase.com/docs/guides/platform/backups) says accessible automatic daily backups are for Pro, Team, and Enterprise; Free projects should make off-site logical exports. PITR is a paid add-on. Database backups exclude Storage object bytes. Neither a current downloadable production backup nor a Storage manifest was verified. No isolated restore was performed; recovery time and data-loss window are unknown. An upgrade or another explicitly approved backup/restore arrangement is required before a commercial migration. No paid service was enabled.

Security advisor at audit: staging reports 24 authenticated-callable `SECURITY DEFINER` functions and leaked-password protection; production reports 22 authenticated-callable functions, one anonymously callable function, five mutable search paths, `pg_trgm` in `public`, and leaked-password protection. The production anonymous function is `public.set_inventory_row_store_id`, a trigger helper; local `20260902090000_release_security_hardening.sql` revokes direct execution, but that migration is absent from production. No production grant was changed. Staging's callable functions are granted to authenticated clients because they are used by authenticated RPCs or RLS checks; the sampled sensitive functions contain role/store checks, but negative tests for every function are not complete. Staging and production have RLS enabled on all inspected `public` and `storage` base tables. Billing tables in staging have no browser policies and grant service-role access. These observations are not a substitute for full tenant-isolation and function-abuse testing.

Supabase [password-security documentation](https://supabase.com/docs/guides/auth/password-security) states leaked-password protection is available on Pro and above; it cannot be enabled on the current Free plan. Password-reset expiry, repeated reset attempts, and session revocation remain unverified.

## Approved-release procedure, after gates pass

1. Freeze the tested Git SHA; deploy it to staging, prove the alias serves that SHA, and repeat hosted critical workflows and Paystack Test Mode payment confirmation.
2. Privately set and verify all production env values, live Paystack key, callback and webhook origins, Auth redirect URLs, and separate staging/production keys. Verify monitoring and readiness diagnostics.
3. Secure a production database backup and Storage object backup, then restore each to an isolated environment. Record duration, source/recovered counts, integrity checks, and recovery-point age. Rehearse the target-specific migrations from [the reconciliation plan](./phase4-migration-reconciliation.md) and the rollback path.
4. Only after explicit production authorization, record the baseline deployment and data snapshot, apply the reviewed migration bundle in the maintenance window, deploy the approved commit, and check health, authenticated flows, payments, and logs.
5. For an application-only regression, roll back to `dpl_2P1t5Tas8s3jgxtDHVGQtzkWZsSs` and recheck. For data corruption, follow the tested database and Storage recovery procedure, accounting for the recorded recovery-point loss. Do not improvise a live restore.
