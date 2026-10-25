# Phase 4 migration reconciliation (24 October 2026)

## Read-only findings

- The working directory originally contained 82 timestamped SQL migrations. It now contains **83**, including the local, unapplied `20261024120000_encrypt_temporary_registration_documents.sql`. The local `staging` Git branch has 82. The branch at this checkout's `HEAD` tracks only 53; the rest of this checkout is uncommitted or untracked work and must be preserved.
- Comparing the 82 working files with the 82 files on `staging` found the same SQL for all common filenames. Two billing files have the same SQL but different migration version prefixes:

| Working directory version | `staging` Git version | SQL comparison |
| --- | --- | --- |
| `20261021120000_new_franchise_billing_price` | `20261021095813_20261021120000_new_franchise_billing_price` | Same after whitespace normalization |
| `20261021130000_initial_month_in_onboarding` | `20261021095816_20261021130000_initial_month_in_onboarding` | Same |

- Read-only PostgREST schema metadata from the separately identified staging and production projects showed 73 and 44 exposed public tables respectively. Staging alone has the franchise, billing, Master Supply, QR registration, and supplier tables. Production has no extra exposed table in this comparison. This is an API-visible schema comparison, not a full catalog or policy diff.
- The reported production migration count of approximately 58 is unverified. `supabase_migrations` is not exposed through PostgREST, and the connected Supabase migration-history tool was unavailable during this audit. Do not infer a database's migration history from a Git branch.
- The new Storage bucket migration was rehearsed against an isolated PGlite baseline with synthetic existing registration evidence. It changed only the private bucket's MIME allowlist and size cap, preserved evidence rows, and was safely repeatable. This focused rehearsal does **not** validate the complete 83-file sequence or a restored staging database.

## Required reconciliation before a deployment

1. With read-only database access, export `supabase_migrations.schema_migrations` versions from **both** project IDs. Capture schema-only catalogs for public tables, columns, indexes, constraints, functions, triggers, RLS, grants, and storage policies. Store private exports securely.
2. Match each recorded version to a reviewed SQL file. For the two renamed billing migrations, compare catalog effects and confirm exactly which version, if any, is recorded in staging. Never apply both copies. Investigate any migration recorded remotely that is absent locally.
3. Compare the final expected schema against each target, including data-preserving constraints and dependencies. Check table and row counts for users, stores, franchises, sales, customers, inventory, and billing before and after any isolated rehearsal.
4. Rehearse the proposed ordered forward migrations and any *history-only* repair in an isolated development database restored from an approved sanitized copy. Verify idempotency, RLS, role denials, payment uniqueness, foreign keys, and that existing records remain intact. A migration filename change alone does not justify a database write.
5. Have the owner review the exact per-target SQL and history-repair commands, backup/restore evidence, and a rollback or forward-fix strategy before authorizing staging work. Production migrations require separate explicit authorization.

No migration was applied, repaired, reset, or pushed during this audit.
