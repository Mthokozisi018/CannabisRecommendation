# Phase 4 final local readiness report — 24 October 2026

## A. Phase 4 fixes

- Preserved the earlier local Zod/Undici security upgrades, billing-price corrections and QR browser-harness fixes. This pass added server-side AES-256-GCM encryption of transient registration images in `lib/registration/document-encryption.ts` and `lib/registration/submit.ts`, an additive private-bucket migration, missing-key staging validation, regression tests and an encryption rollout document.
- Added a Phase 5 deployment plan and expanded recovery procedures. No deployment, push, remote migration, Paystack live-mode action, or production write occurred.

## B. Database readiness

- Current working tree has 83 forward SQL files, including the new unapplied document-bucket migration. The staging Git branch has 82. Two billing SQL files have alternate migration version prefixes despite equivalent SQL. Current `HEAD` tracks only 53 migrations, so it is not a release candidate.
- Read-only API metadata showed 73 public tables in staging and 44 in production; staging-only franchise, billing, Master Supply, registration and supplier tables are consistent with unreleased features. This is not a full database catalog comparison. Authoritative applied-version histories, RLS/functions/triggers/index catalogs and production migration count remain unavailable. No history repair or remote migration was attempted.
- An isolated PGlite rehearsal of the new bucket migration preserved existing synthetic registration rows and was repeatable. The complete 83-file migration sequence has **not** been rehearsed against a sanitized restore. See `phase4-migration-reconciliation.md` for the required per-target procedure.

## C. Paystack readiness

- Local pricing remains independent R2,500 onboarding + R1,500 first month = R4,000; franchise R4,500 onboarding + R2,500 first month = R7,000 for one store, plus R1,000 per additional store per month. The unit suite covers additional stores, changed amounts, first-month renewal timing, test-key-only use, matching server-side verification, webhook HMAC and grace access.
- Local production build includes `/billing/payment/callback` and `/api/payments/paystack/webhook`. The application requires an exact HTTPS callback origin and verifies the transaction server-side before applying payment. Webhooks validate raw-body HMAC-SHA512. [Paystack's developer guidance](https://paystack.com/docs/payments/accept-payments/) also requires transaction verification before granting value, and [its webhook guidance](https://paystack.com/docs/payments/webhooks/) specifies the signature header.
- `verify:staging-env` fails on the two still-missing public callback/webhook URLs. There is no verified hosted staging origin. Hosted checkout, webhook, renewals, failures, reconciliation and subscription lifecycle tests remain pending deployment authorization.

## D. Security readiness

- Local unit, security and PGlite suites include role/tenant denials, store-scoped POS customer linkage, restricted registration evidence, payment amount matching, invalid webhook signatures, idempotency, password policy and readiness checks. Authenticated hosted sessions and authoritative live RLS catalog verification remain pending.
- Full ID/passport numbers and OCR results are not persisted by the audited QR path. It stores a keyed fingerprint and last four. The temporary photo upload is now encrypted before Storage; tampering, wrong context and wrong key fail decryption. Key backup/rotation, existing-record inventory and hosted encrypted-object verification are still release gates. See `phase4-identification-encryption.md`.
- Secret scan passed for 980 files. Production dependency audit reported zero vulnerabilities. This does not establish absence of every application vulnerability.

## E. Backup and recovery readiness

- The recovery runbook covers deletion, corruption, failed migration, compromised credentials, deployment failure, lost objects and major outage. Proposed targets are 15-minute RPO for transaction data, 24-hour RPO for nontransactional images, 4-hour RTO for login/POS and 24-hour RTO for remaining features. These are unapproved and unmeasured.
- Supabase documents plan-dependent daily backups and optional PITR. Its [backup guidance](https://supabase.com/docs/guides/platform/backups) states database backups do not include Storage object bytes. Project-specific plan, schedule, retention, PITR state, independent object backup and key-recovery evidence were not available. No representative backup restore was performed.

## F. Testing results

| Check | Result |
| --- | --- |
| TypeScript | Pass |
| ESLint | Pass with 1 pre-existing checkout navigation warning |
| Migration validation | 83/83 forward SQL filenames pass |
| Secret scan | 980 files pass |
| Unit/integration/security | 807 passed, 0 failed, 0 skipped across 141 files on clean rerun |
| QR/POS isolated browser | 27 passed, 0 failed, 0 skipped |
| Franchise isolated browser | 29 passed, 0 failed, 0 skipped |
| Local POS confirmation database | Pass |
| Local POS search/database | Pass with 50,002 synthetic customers |
| Production build | Pass |
| Production dependency audit | 0 vulnerabilities reported |
| Local environment verifier | Pass |
| Staging environment verifier | Fail: 2 missing public Paystack URLs |

The first full test attempt had one 30-second franchise-loader timeout while a separate large PGlite workload was running. That test passed in isolation and the uncontended full rerun passed 807/807. The search fixture measured best-of-three name lookups falling from 199.2/184.7 ms to 16.8/19.0 ms after the tested index migration; phone lookup changed from 2.17 to 2.45 ms. These are local synthetic measurements, not production latency or capacity claims. Existing PGlite security tests exercise two concurrent Master Supply requests; realistic multi-business POS load, connection saturation and hosted API latency remain unmeasured.

## G. Outstanding issues by severity

- **Release blocker:** authoritative Supabase migration histories and full catalog/RLS diff unavailable; two billing version conflicts unresolved; complete migration rehearsal unavailable.
- **Release blocker:** project-specific backup/PITR/object coverage, isolated restore and key recovery unverified.
- **Release blocker:** document key not provisioned for hosted staging; broader inventory of retained identification fields and authorized access remains incomplete.
- **Staging gate:** public staging origin and Paystack callback/webhook settings absent; hosted billing/tenant/auth/workflow checks cannot yet be claimed.
- **Release preparation:** no exact release commit exists because the worktree contains extensive pre-existing edits and untracked files. The intended release content requires deliberate review.
- **Low:** one existing ESLint navigation warning; changing full reload may alter cart reset behavior.

The planned production exclusion of Pending Orders is supported by candidate code that defaults it off when `VERCEL_ENV=production`; a read-only check found no production `GREENCHOICE_PENDING_ORDERS_ENABLED` override in the linked Vercel project. Verify the effective flag again at the eventual exact release deployment.

## H. Phase 5 deployment plan

Follow `phase5-deployment-plan.md`: resolve the migration/recovery/encryption gates, review and pin an exact commit, verify environment and backups, obtain staging deployment authorization, deploy only that commit to the verified staging target, execute hosted authenticated/Paystack/tenant/restore checks, then hold a separate production readiness review. Production deployment and migrations require separate explicit authorization.

## I. Verdict

**PHASE 4 — NOT READY.** Local application validation is strong, but the migration and recovery gates are not yet evidenced. This verdict does not authorize staging or production deployment.
