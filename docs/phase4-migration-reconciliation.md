# Phase 4 migration reconciliation — 24 October 2026

**Status: version inventory and schema comparison complete; migration-body review and execution plan unvalidated. No database history or schema was changed.**

Projects: staging `jezbvjepxosphdrykrcg`; production `nfrvbnthsmlyqzmvqylh`. The repository has 82 forward migrations. Staging records 82, with 14 local-only and 14 remote-only versions. Production records 58, with 27 local-only and 3 remote-only versions. Recorded statement text is not a reliable raw-file checksum: the migration runner changes whitespace and statement boundaries. Compare schema effects and data preconditions in a restored copy.

## Staging version mapping

The left column is the staging record; the right is the repository file version. "Exact" means the stored SQL matches the local file after the runner's final line ending is accounted for. "Normalized" means semantically matching SQL after whitespace normalization; inspect the stored statements during the restore rehearsal.

| Staging version | Local version | Finding |
| --- | --- | --- |
| `20260914143617` POS checkout payment methods | `20260909122435` POS payment and customer search | **Different implementations.** Staging has a 11,455-character advanced checkout function and payment constraint. Local migration has a 5,218-character wrapper implementation. Compare the final installed functions and constraints before planning a forward change. |
| `20260917064128` supplier management | `20260917063849` | Exact |
| `20260917071646` supplier hardening | `20260917071558` | Exact |
| `20260929105506` supplier metadata | `20260929104753` | Whitespace differs |
| `20261002065154` POS customer search outbox | `20261001120000` | Exact |
| `20261016101755` POS sale confirmation | `20261016095315` | Exact |
| `20261021164620` verified payment welcome | `20261021154404` | Normalized |
| `20261023180629` secure manager store updates | `20260902100242` | Exact |
| `20261023180644` security followup | `20261006072152` | Exact |
| `20261023180657` store QR registration | `20261007130205` | Exact |
| `20261023180731` franchise remediation | `20261016174201` | Exact |
| `20261023180745` manager net revenue | `20261017093549` | Normalized |
| `20261023180813` master supply cost | `20261021185315` | Normalized |
| `20261023180827` manager supply requests | `20261023071927` | Exact |

These mappings are evidence of equivalent recorded changes, not authorization to mark versions applied. The POS pair needs separate treatment.

## Production-only history and schema

- `20260913155800_pos_payment_and_customer_search`: an earlier POS implementation. Unlike local `20260909122435`, it does not add `pos_sales.payment_status`; the payment allocation constraint also differs.
- `20261016140956_production_read_only_demo`: creates `private.demo_accounts`, identity and MFA protection triggers, restrictive read/write policies across then-existing public tables, storage boundaries, and write-rejection triggers. The policies are conditional on the registered demo identity and preserve normal user access. Preserve this layer and its data; extend the boundary to newly introduced tables after a restore test.
- `20261016141548_demo_canonical_image_scope`: narrows demo storage reads to canonical product-image paths. Preserve it.

Read-only schema inventories found staging 804 and production 525 columns in `public`/`private`, with the only production-only columns belonging to `private.demo_accounts`. Staging has 96 functions, 103 policies, 224 indexes, and 459 constraints; production has 86 functions, 246 policies, 139 indexes, and 278 constraints. Production's extra policies mainly belong to the demo layer. All inspected `public` and `storage` base tables have RLS enabled in both projects (81 staging, 52 production). Shared function bodies and several constraints differ; these require a restored-copy diff after ordered migration application.

## Local migrations absent from production

The 27 versions, in file order, are:

```text
20260902090000  20260902100242  20260909122435  20260917063849
20260917071558  20260929104753  20261001120000  20261003084933
20261006072152  20261007130205  20261007134647  20261010085411
20261011102153  20261011103925  20261013060837  20261015083038
20261016095315  20261016174201  20261017093549  20261019132156
20261020090458  20261020180659  20261021095813  20261021095816
20261021154404  20261021185315  20261023071927
```

The exact filenames are in `supabase/migrations`. Some changes may already exist in production under another version; several plainly do not (billing, franchise, supply). Neither the 27 files nor a blanket `migration repair` command can be run safely on production as-is.

## Release rehearsal and forward execution plan

1. Establish a recoverable production backup, including a separately verified copy of Storage objects. Record creation time, row/object counts, checksums or manifest, recovery point, and restore credentials without committing secrets. The organization is currently Free; provider daily backups are not accessible under this plan. Do not assume an automatic backup exists.
2. Restore that backup into an **isolated disposable database**. Never restore into the active production project. Compare data counts, FK validity, representative customer/order/sale/inventory records, and object-manifest coverage against the source. Record restore duration and maximum data-loss interval.
3. On the isolated copy, replay the missing changes in dependency order. For the POS version conflict, first diff installed functions, columns, and constraints, then use a purpose-built forward migration that keeps historical sales intact. For the demo layer, preserve `private.demo_accounts` and extend its restrictive policies/triggers to every new public table and relevant Storage paths. Never drop demo protection merely to make migration replay pass.
4. Compare the resulting schema, function definitions, grants, RLS policies, indexes, and constraints against staging, allowing only documented production-specific demo objects. Run negative role and cross-store tests, billing tests, and core workflow tests against the restored copy. Confirm counts and totals for customer, transaction, product, and inventory data are unchanged by schema changes.
5. Generate and review a target-specific SQL release bundle and rollback/recovery runbook. Only after the rehearsal passes, during an explicitly authorized maintenance window, take another verified backup and apply the reviewed bundle transactionally where practical. Record individual migration history entries **only for changes actually applied and verified**. Do not use `db push` or rewrite history as a shortcut.

**Blocker:** a verified production backup and isolated restore rehearsal have not occurred. The current Free plan provides no accessible automatic daily backup for this release gate. No disposable project or paid service was created.
