# Phase 5 free-tier recovery evidence (25 October 2026)

This is the pre-migration evidence for the existing production Supabase project. No production SQL or Storage write was performed during the backup or rehearsal. The protected backup directory is `C:\Users\MthokozisiP\.codex\private-backups\greenchoice-2026-10-25`; its ACL permits the current Windows user. Do not commit or upload that directory.

## Independent backups

- `roles.sql`, `schema-verified.sql`, `data.sql`, `history-schema.sql`, and `history-data.sql` are nonempty Supabase CLI exports. `backup-verification.json` records their sizes and SHA-256 hashes. The zero-byte `schema.sql` from an initial failed Docker connection is **invalid** and excluded from the manifest and restore.
- The `product-images` bucket was enumerated through the Storage API with an explicit production project-ref check. Its 59 objects (8,314,090 bytes) were downloaded independently of the database dump into `product-images-api/`. Its manifest records each object path, byte count, and SHA-256 hash.
- The database dump includes Storage metadata, not Storage file bytes. No identification-document objects existed in the three pre-migration buckets; the new private document bucket is introduced by the pending migration. Future backups must include that bucket as soon as it contains objects.
- The document encryption key and separate customer ID HMAC secret have protected raw custody files and Windows DPAPI recovery copies in the same private directory. Both DPAPI copies were decrypted and compared with their originals. These are local recovery copies, not an offsite backup.

## Isolated restore verification

The five database components were restored with `psql --single-transaction -v ON_ERROR_STOP=1` to an isolated local Supabase PostgreSQL container (`supabase_db_restore-lab`). It exited successfully with no SQL errors. Counts matched production: 7 stores, 3 POS customers, 86 POS sales, 182 inventory rows, 59 Storage metadata objects, 11 Auth users, and 58 migration history versions. Public/private catalog counts also matched: 46 tables, 246 policies, 86 functions, 106 triggers, 139 indexes, and 278 constraints.

`scripts/restore-storage-backup-local.mjs` reconstructed all 59 objects into a separate local directory and verified every SHA-256 hash. This proves recoverable file bytes; it does not prove a remote Storage upload, which has not been attempted.

For another isolated restore, initialize and start a fresh local Supabase workdir with a unique DB port, copy the five files into its database container, then run them in order with `psql -U postgres -d postgres -X --single-transaction -v ON_ERROR_STOP=1`, setting `session_replication_role = replica` immediately before `data.sql`. Verify row counts and catalog objects before using the clone. Do not restore over production as a migration repair.

## Migration reconciliation and rehearsal

The authoritative production history has 58 applied versions; 28 local versions were pending. Three applied production versions were absent from the original checkout: `20260913155800`, `20261016140956`, and `20261016141548`. Local no-op history markers now represent them, bringing the local migration file count to 86. The original production-only demo SQL includes account material and remains only in the protected database-history backup. The first remote-only version is an alternate POS payment migration. Its effects overlap local `20260909122435`, but production lacked `pos_sales.payment_status`. The local migration was made idempotent for its already-present columns, constraint, function, and indexes while adding the missing status column and updating the v3 sale function. It did not drop or rewrite sale records. A linked `supabase db push --include-all --dry-run` now succeeds and lists exactly the 28 pending files.

A second local Supabase database (`supabase_db_migration-lab`) was restored from the same protected dump. All 28 pending files then ran in timestamp order in individual transactions. The 28 migration-history entries were added **only in the lab**. Before/after counts stayed at 7 stores, 3 POS customers, 86 sales, 182 inventory rows, 59 Storage metadata objects, and 11 Auth users. The resulting lab has 86 migration versions, 4 Storage buckets, the `payment_status` column, and RLS enabled on stores, store memberships, POS customers/sales, inventory, franchises, and billing accounts/payments. Billing tables contain zero preexisting rows.

The two billing filename conflicts are in the separate staging project. Its remote history records `20261021095813` and `20261021095816`; this checkout instead contains `20261021120000` and `20261021130000` with matching SQL after whitespace normalization. Neither billing variant was applied in production before this rehearsal. Staging needs its own history reconciliation before any future staging push.

## Recovery limits and required next backup

Supabase Free does not provide this project with a verified managed point-in-time recovery path. The local protected directory is a single-site copy; copy it to an independent encrypted location under owner custody before relying on it for disaster recovery. The export represents a point in time. Immediately before a production migration, repeat the database and Storage captures and isolated verification to minimize loss from intervening writes. Preserve the encryption and HMAC keys independently: losing the document key makes encrypted documents unrecoverable.
