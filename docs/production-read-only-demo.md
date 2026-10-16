# Production read-only demo

This change is based on production commit `bbd355db7c2327324954d84451b3132f53064457` in the isolated `demo/read-only-production-20261016` branch. Do not deploy the separate local development checkout.

The dedicated manager identity has the administrator-controlled Auth flag `app_metadata.greenchoice_demo_view_only=true` and a matching private `demo_accounts` row. Never use editable user metadata or an email comparison for authorization. Both records must remain paired.

The UI retains existing viewing pages, filters, product details and sales reports. Demo-only controls hide mutation entry points. Backend origin verification denies demo mutations by default; explicitly read-only search/report/export and logout operations retain their normal authorization and origin checks. Dashboard routes outside the viewing allowlist redirect to the manager home.

The migration adds restrictive demo policies and write-rejection triggers to existing public tables, plus storage policies. Existing normal-user policies remain authoritative. For tables previously without RLS, a normal-user policy preserves their previous grant-based access. Triggers also stop writes inside definer RPCs. The private marker table has no client-accessible policy or grants. Demo credentials, metadata, MFA and provider identities cannot be changed through Auth endpoints; ordinary sign-in timestamps can still update. New snapshot stores/products are excluded from ordinary customer catalogues.

## Operator provisioning

1. Verify the branch parent, inspect the complete diff, run type checking, lint, tests, migration validation, secret scan and production build.
2. Test the migration locally: `PGLITE_MODULE` can point to an installed `@electric-sql/pglite` module; run `node scripts/verify-demo-database.mjs`. It uses an in-memory fixture and never connects to production.
3. Apply only `20261016135603_production_read_only_demo.sql` to the verified production Supabase project. The empty marker registry leaves normal users unchanged.
4. Deploy only the isolated reviewed commit, retaining existing production configuration and deployment protection.
5. Load the existing production Supabase URL and server key into the operator process, then run `node scripts/prepare-production-demo.mjs <private-directory-outside-repository>`. The script creates a new login and physically copies and hashes the 28 product images. It saves credentials in a private journal, never stdout. Do not commit that directory.
6. Inspect and execute its generated `snapshot.sql` as an administrator. This atomically creates the dedicated store/profile, marker, 59 copied products and independent stock rows. Twelve generated historical sales provide demonstration reporting. No real customer, supplier, staff or original sale records are copied. The synthetic sales do not change snapshot stock.
7. Verify normal login, allowed pages, hidden modification controls, direct API writes, cross-store reads, RPC writes, password/email changes, source fingerprints and the production commit before sharing credentials.

There is no synchronization with the source inventory. Source rows and images are never updated or removed. Refreshing a snapshot is an explicit administrator operation. Shared-login credential rotation also requires a privileged, audited maintenance operation because the database intentionally blocks ordinary Auth credential changes. Do not expose the provisioning journal, server key or private marker table.
