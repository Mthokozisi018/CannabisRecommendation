# Phase 3 staging verification and production checklist

Status: **NOT READY FOR PRODUCTION DEPLOYMENT** (23 October 2026)

## Executed evidence

- Staging URL: `https://greenchoice-workstation-staging.vercel.app/`; initial deployed commit `3846187c97ca5ff956a09b057808e072cc0543d2`.
- `npm run check`: lint completed with one existing customer checkout navigation warning; TypeScript, 82 migration-file validation, secret scan, 809/809 Vitest cases, and production dependency audit passed (zero high vulnerabilities).
- `npm run build:staging`: passed, including TypeScript and route generation.
- Hosted Playwright, using staging-only generated fixtures: franchise administration passed (onboarding, access restriction before billing, stores, tenant isolation, staffing limits, sales analytics); admin-to-manager onboarding passed (temporary password, account and store setup, billing restriction, private store reads and dashboard navigation). These tests set their own billing account to active after verifying the unpaid gate. That fixture action does **not** verify a Paystack payment.
- Hosted Playwright anonymous workflow checks: 2 passed; `/api/health` returned HTTP 200 and private dashboard/account URLs redirected to login.
- Paystack Test Mode guard passed. The staging test key authenticated to Paystack's API; a nonexistent transaction reference was rejected without a charge.
- Staging fixture cleanup was checked in SQL: zero generated staff, franchises, and stores remained.
- Last 30-minute Vercel log query found zero `status:500` records. Three error-level log entries were anonymous QR authentication denials; the endpoint returned HTTP 401 when probed.

## Remaining verification gates

- Complete real Paystack **test-mode** checkout, provider verification, webhook replay/idempotency, subscription activation and renewal date, failed-payment grace/recovery, and franchise additional-store price verification. No live payments may be used in staging tests.
- Exercise authenticated receptionist POS cash/card/split checkout, correction/refund, customer registration/search; customer sign-up, login, account, browse and orders; manager products, inventory, reports, staff, supply and refunds; and franchise master inventory/supply requests, approvals, distribution/history in the hosted browser. Unit tests and route presence do not count as hosted workflow verification.
- Test the complete password recovery page and link, including expiry and old-password rejection. Manager password change during onboarding passed; recovery remains untested.
- Resolve migration history before any `db push`. The repository and staging each have 82 migration entries but 14 version mismatches in each direction. Several stored SQL bodies match local files under different versions; some differ. Production has 58 recorded migrations, including 3 versions not present locally, while 27 local versions are absent there. Do not mark versions applied merely to silence the diff. Review SQL bodies and schema/data effects in an isolated copy, take a verified backup, and prepare a target-specific forward plan.
- Confirm production Supabase backup policy, latest successful backup, point-in-time recovery availability, restore permissions, and a restore drill. Project health alone does not verify recovery.
- Complete production Vercel environment variables. The inspected 23 entries omit Paystack settings and other Phase 2 configuration keys. Verify values privately, callback/webhook origins, production Supabase ref, and secret separation.
- Choose and verify commercial Paystack live-mode configuration separately before taking real payments. The current billing runtime accepts test keys only; this release cannot yet process commercial live billing.
- Resolve staging Supabase security-advisor warnings or document reviewed exceptions: 24 authenticated callable security-definer functions and leaked-password protection. Confirm function role checks with negative authenticated tests.

## Deployment and rollback checklist

1. Freeze an exact release commit; deploy that commit to staging and repeat the full gate and critical hosted browser tests.
2. Verify production environment variables and Paystack webhook ownership without printing secret values.
3. Verify current production database backup and restore readiness; reconcile both migration histories and inspect a migration dry run against a copy of production data. Never run `db push` against either target until that review is complete.
4. Record baseline production deployment ID, database version, health and error rate. Keep the existing known-good production deployment available as a rollback candidate.
5. After explicit authorization, deploy only the approved commit. Check `/api/health`, authenticated smoke flows, billing mode, and runtime logs.
6. If application health regresses, use Vercel `rollback <previous-deployment-id>` and `rollback status`, then repeat health/log checks. Vercel rollback reverses code routing only; database recovery needs the separate tested restore plan. No rollback was executed in Phase 3.

No production database write or production deployment was performed during this verification.
