# Phase 4 recovery preparation (24 October 2026)

This is a release gate, not evidence of a tested restore. No production restore, database migration, or deployment is authorized by this document.

## Inventory and ownership

- Record the production and staging Supabase project IDs, Vercel project IDs, storage buckets, Paystack Test Mode account, DNS owner, and incident contacts in the private operations vault. Do not put credentials or backup files in this repository.
- Record which Supabase plan and backup features are actually enabled for each project. Confirm backup schedule, retention, point-in-time recovery availability, and who can initiate a restore in the Supabase dashboard. A paid plan alone does not establish these facts.
- Inventory Storage buckets and any external product or registration-document storage. Database backups do not prove that object bytes, versions, and deletion history can be recovered. Confirm a separate object backup and a sample object restore.
- Record the independent retention policy for audit logs, payment references, and customer records. Keep backup encryption, access, and deletion controls with the owner.

## Recovery objectives to approve

- **Proposed RPO:** 15 minutes for committed sales, inventory and billing database data; 24 hours for nontransactional product images. Registration document photos are intentionally temporary and normally deleted within one hour. These targets require PITR or equivalent capture plus separately scheduled object backups. They are proposals, **not achieved or approved objectives**.
- **Proposed RTO:** 4 hours for core login and POS; 24 hours for remaining dashboards and media. These are proposals, **not measured objectives**. Measure them in an isolated drill before release.
- Assign one incident lead and one independent verifier. Record contact and escalation paths privately.

## Isolated restore drill

1. Obtain an approved backup copy and create an isolated target project with no production application or Paystack credentials. Never restore into production for a drill.
2. Restore the database and separately restore Storage objects. Disable outbound email, webhooks, subscriptions, cron jobs, and any payment actions on the drill target.
3. Compare table counts, critical schema, RLS policies, grants, functions, triggers, migration history, and object counts against the backup inventory. Use synthetic accounts for login and authorization tests.
4. Check that stores, franchises, staff, customers, sales, refunds, inventory, supply requests, and billing references remain linked. Verify cross-store and cross-franchise denials. Reconcile a sample of financial totals without issuing provider calls.
5. Measure backup timestamp to incident timestamp (actual RPO) and start to verified service (actual RTO). Record missing objects, failed checks, and corrective actions. Keep the evidence outside this repository if it contains private data.

## Incident procedures

- **Accidental deletion:** stop the affected writer, record the last good timestamp and scope, clone or restore into isolation, compare affected rows and object versions, then review a selective forward repair. Avoid an immediate full-project rollback that would discard later sales.
- **Corruption or failed migration:** disable writes, retain diagnostics and the exact migration version, restore a separate copy to the last consistent point, validate RLS and financial invariants, then decide between a reviewed forward correction and a full restore. Preserve the pre-migration backup until reconciliation finishes.
- **Compromised credentials:** revoke the affected token/key and sessions, rotate Supabase/Paystack/Redis/application secrets through the private vault, review audit and payment events, and redeploy only after credentials and access paths are verified. Keep test and production credentials separate.
- **Deployment failure:** pause promotion, inspect build and runtime logs, restore the previously verified Vercel deployment if its database compatibility is confirmed, and run smoke tests for login, POS and billing before reopening traffic.
- **Lost Storage files:** restore object bytes from the independent object backup to an isolated bucket, reconcile paths and metadata against the database, then copy only reviewed objects to the target. Database restore alone cannot recover deleted object bytes.
- **Major outage:** declare incident ownership, freeze billing and POS mutations if consistency cannot be guaranteed, assess provider status, communicate service state, restore to an isolated region/project if needed, and reconcile payment references and sales before resuming writes.

## Encryption key recovery

- Keep the customer-document AES key in a managed server-side secret store separate from Supabase. Back up key material in a second access-controlled location, inventory its version and custodians, and test recovery on a synthetic ciphertext sample. Never put key material or sample decrypted IDs in this repository.
- Current encrypted registration photos are short lived; rotation requires retaining the previous key until its queued objects are deleted and verified absent. The `GCD1` format is versioned, but the current envelope has no key identifier and the app has no document-viewing endpoint. Do not add persistent encrypted document retention or a reader without a versioned keyring, role checks, access audit, and restore test.

## Application rollback and observability

- Record the current production deployment ID and tested rollback candidate before any future release. A code rollback may still require a forward-compatible database schema; review migrations before promotion or rollback.
- Keep `/api/health` as liveness and authenticated `/api/health/readiness` as the database-aware check. Confirm that the readiness secret, alert delivery, and monitoring checks work in staging before release.
- Verify Sentry error intake, alert routing, and ownership for authentication, POS, inventory, billing webhook failures, migration errors, and readiness failures. Existing Sentry configuration does not prove that alerts are delivered.
- Exercise database outage and recovery in staging. Confirm bounded request timeouts, useful errors, retry behavior, and that payment or inventory writes are not duplicated.

## Release gate

Do not declare recovery readiness until backup availability and retention are verified, object coverage is confirmed, an isolated restore drill meets approved RPO/RTO targets, and the rollback and alert paths are exercised. Preserve the production project throughout this work.
