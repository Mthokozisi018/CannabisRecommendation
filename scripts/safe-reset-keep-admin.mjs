#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ADMIN_DISPLAY_NAME = "GreenChoice Administrator";
const ADMIN_FIRST_NAME = "GreenChoice";
const ADMIN_SURNAME = "Administrator";
const PRODUCT_STORAGE_BUCKETS = ["products", "product-images"];

const APP_EXPECTED_COLUMNS = {
  staff_profiles: [
    "auth_user_id",
    "email",
    "full_name",
    "role",
    "is_active",
    "account_status",
    "store_id",
    "account_setup_complete",
    "profile_setup_complete",
    "store_setup_complete",
    "terms_accepted_at",
    "privacy_policy_accepted_at",
    "terms_version",
    "privacy_policy_version",
    "onboarding_complete_seen_at",
    "temporary_password_active",
    "password_changed_at"
  ],
  manager_invitations: [
    "email",
    "status",
    "invited_by",
    "expires_at",
    "temporary_password_auth_user_id",
    "temporary_password_issued_at"
  ]
};

const DELETE_TARGETS = [
  { schema: "public", table: "pos_sale_items", reason: "POS sale line items" },
  { schema: "public", table: "order_events", reason: "order history events" },
  { schema: "public", table: "orders", reason: "orders linked to carts/stores" },
  { schema: "public", table: "cart_items", reason: "cart line items" },
  { schema: "public", table: "carts", reason: "saved/draft carts" },
  { schema: "public", table: "recommendation_sessions", reason: "recommendation/onboarding shopping sessions" },
  { schema: "public", table: "import_job_errors", reason: "import validation rows" },
  { schema: "public", table: "import_jobs", reason: "product import jobs" },
  { schema: "public", table: "inventory_movements", reason: "stock movement history" },
  { schema: "public", table: "inventory_stock", reason: "manager inventory stock rows" },
  { schema: "public", table: "inventory_items", reason: "legacy inventory item rows" },
  { schema: "public", table: "product_lineage", reason: "product lineage links" },
  { schema: "public", table: "product_effect_scores", reason: "product effect links" },
  { schema: "public", table: "product_terpenes", reason: "product terpene links" },
  { schema: "public", table: "product_flavors", reason: "product flavor links" },
  { schema: "public", table: "product_images", reason: "product image metadata rows" },
  { schema: "public", table: "products", reason: "store products" },
  { schema: "public", table: "audit_events", reason: "store-scoped structured audit events" },
  { schema: "public", table: "audit_logs", reason: "old manager/admin operational audit rows" },
  { schema: "public", table: "manager_invitations", reason: "pending/accepted/revoked manager invitations" },
  { schema: "public", table: "store_memberships", reason: "legacy store membership rows" },
  {
    schema: "public",
    table: "staff_profiles",
    reason: "all manager/receptionist/staff profiles except the kept admin",
    where: ({ adminUserId }) => `where auth_user_id <> ${sqlUuid(adminUserId)}`
  },
  {
    schema: "public",
    table: "profiles",
    reason: "legacy profiles except the kept admin",
    where: ({ adminUserId }) => `where id <> ${sqlUuid(adminUserId)}`
  },
  { schema: "public", table: "stores", reason: "all store records, including demo/test stores" }
];

const PRESERVED_REFERENCE_TABLES = [
  "public.categories",
  "public.effects",
  "public.terpenes",
  "public.flavors",
  "storage.buckets"
];

function parseArgs(argv) {
  const args = {
    execute: false,
    help: false,
    plan: false,
    printSql: false,
    confirmReset: "",
    deleteProductStorageObjects: false
  };

  for (const rawArg of argv) {
    const [key, ...valueParts] = rawArg.split("=");
    const value = valueParts.join("=");
    if (rawArg === "--execute") args.execute = true;
    else if (rawArg === "--dry-run") args.execute = false;
    else if (rawArg === "--help" || rawArg === "-h") args.help = true;
    else if (rawArg === "--plan") args.plan = true;
    else if (rawArg === "--print-sql") args.printSql = true;
    else if (rawArg === "--delete-product-storage-objects") args.deleteProductStorageObjects = true;
    else if (key === "--confirm-reset") args.confirmReset = value;
    else throw new Error(`Unknown argument: ${rawArg}`);
  }

  return args;
}

function usage() {
  return `
GreenChoice safe data reset, keeping one admin account.

Default mode is a dry run. No data is deleted unless --execute is provided.

Commands:
  node scripts/safe-reset-keep-admin.mjs --plan
  node scripts/safe-reset-keep-admin.mjs --dry-run
  node scripts/safe-reset-keep-admin.mjs --print-sql
  node scripts/safe-reset-keep-admin.mjs --execute --confirm-reset=<ADMIN_EMAIL>

Required for dry-run counts and execution:
  SUPABASE_DB_URL or DATABASE_URL       Direct Postgres connection URL.
  NEXT_PUBLIC_SUPABASE_URL              Supabase project URL.
  SUPABASE_SECRET_KEY or
  SUPABASE_SERVICE_ROLE_KEY             Supabase backend admin key.

Required only for --execute:
  ADMIN_INITIAL_PASSWORD or ADMIN_PASSWORD

Optional:
  ADMIN_EMAIL                           Administrator account to preserve.
  --delete-product-storage-objects       Also deletes storage.objects rows in product image buckets.

Safety:
  - The SQL uses DELETE FROM only.
  - No DROP TABLE, DROP SCHEMA, TRUNCATE, ALTER, migration edits, policy edits, or bucket deletion.
  - Product storage buckets are never deleted.
  - Admin password is read from environment only and is never printed or written to SQL.
`.trim();
}

function scriptRoot() {
  return dirname(fileURLToPath(import.meta.url));
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (!key || process.env[key]) continue;
    process.env[key] = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
  }
}

function loadLocalEnv() {
  const projectRoot = resolve(scriptRoot(), "..");
  loadEnvFile(join(projectRoot, ".env.local"));
}

function configuredValue(name) {
  const value = process.env[name]?.trim();
  if (!value || /replace-with|placeholder|your-/i.test(value)) return "";
  return value;
}

function requiredEnv(name) {
  const value = configuredValue(name);
  if (!value) throw new Error(`${name} is missing or still a placeholder.`);
  return value;
}

function requiredSupabaseAdminKey() {
  return configuredValue("SUPABASE_SECRET_KEY") || requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
}

function adminEmail() {
  return requiredEnv("ADMIN_EMAIL").toLowerCase();
}

function adminPassword() {
  return configuredValue("ADMIN_INITIAL_PASSWORD") || configuredValue("ADMIN_PASSWORD");
}

function createAdminClient() {
  return createClient(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"), requiredSupabaseAdminKey(), {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

async function listAuthUsers(admin) {
  const users = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    users.push(...(data.users ?? []));
    if (!data.users || data.users.length < perPage) return users;
    page += 1;
  }
}

async function findAuthUserByEmail(admin, email) {
  const normalized = email.toLowerCase();
  const users = await listAuthUsers(admin);
  return users.find((user) => user.email?.toLowerCase() === normalized) ?? null;
}

async function ensureAdminAuthUser(admin, email, execute) {
  const existing = await findAuthUserByEmail(admin, email);
  if (!execute) {
    return { user: existing, created: false, updated: false };
  }

  const password = adminPassword();
  if (!password) {
    throw new Error("ADMIN_INITIAL_PASSWORD or ADMIN_PASSWORD is required for --execute. The password is not logged or written to disk.");
  }

  const userMetadata = { full_name: ADMIN_DISPLAY_NAME, role: "admin" };
  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      email,
      password,
      email_confirm: true,
      user_metadata: userMetadata
    });
    if (error) throw new Error(error.message);
    return { user: data.user, created: false, updated: true };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: userMetadata
  });
  if (error) throw new Error(error.message);
  return { user: data.user, created: true, updated: false };
}

async function fetchRestSchema() {
  const url = `${requiredEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "")}/rest/v1/`;
  const key = requiredSupabaseAdminKey();
  const response = await fetch(url, {
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      accept: "application/openapi+json"
    }
  });
  if (!response.ok) throw new Error(`Unable to inspect Supabase REST schema: HTTP ${response.status}`);
  const body = await response.json();
  const definitions = body.definitions ?? body.components?.schemas ?? {};
  return Object.fromEntries(
    Object.entries(definitions).map(([table, definition]) => [table, Object.keys(definition.properties ?? {})])
  );
}

function schemaWarnings(restSchema) {
  const warnings = [];
  for (const [table, columns] of Object.entries(APP_EXPECTED_COLUMNS)) {
    const actual = restSchema[table] ?? [];
    if (actual.length === 0) {
      warnings.push(`Expected app table public.${table} is not exposed through REST schema.`);
      continue;
    }
    const missing = columns.filter((column) => !actual.includes(column));
    if (missing.length > 0) {
      warnings.push(`public.${table} is missing app-expected column(s): ${missing.join(", ")}`);
    }
  }
  return warnings;
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlUuid(value) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`Invalid UUID: ${value}`);
  }
  return `${sqlLiteral(value)}::uuid`;
}

function quotedIdent(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function tableRef(target) {
  return `${quotedIdent(target.schema)}.${quotedIdent(target.table)}`;
}

function regclassLiteral(target) {
  return sqlLiteral(`${target.schema}.${target.table}`);
}

function targetsForRun({ adminUserId, includeStorageObjects }) {
  const targets = DELETE_TARGETS.map((target) => ({
    ...target,
    whereSql: typeof target.where === "function" ? target.where({ adminUserId }) : ""
  }));

  if (includeStorageObjects) {
    targets.splice(targets.findIndex((target) => target.table === "product_images") + 1, 0, {
      schema: "storage",
      table: "objects",
      reason: `product image files in ${PRODUCT_STORAGE_BUCKETS.join(", ")} buckets`,
      whereSql: `where bucket_id in (${PRODUCT_STORAGE_BUCKETS.map(sqlLiteral).join(", ")})`
    });
  }

  return targets;
}

function countBlock(target) {
  const whereSql = target.whereSql ? ` ${target.whereSql}` : "";
  const statement = `select count(*) from ${tableRef(target)}${whereSql}`;
  return `
  IF to_regclass(${regclassLiteral(target)}) IS NOT NULL THEN
    EXECUTE ${sqlLiteral(statement)} INTO row_count;
    RAISE NOTICE '% | % row(s) | %', ${sqlLiteral(`${target.schema}.${target.table}`)}, row_count, ${sqlLiteral(target.reason)};
  ELSE
    RAISE NOTICE '% | skipped, table not present | %', ${sqlLiteral(`${target.schema}.${target.table}`)}, ${sqlLiteral(target.reason)};
  END IF;`;
}

function deleteBlock(target) {
  const whereSql = target.whereSql ? ` ${target.whereSql}` : "";
  const statement = `delete from ${tableRef(target)}${whereSql}`;
  return `
DO $greenchoice_reset$
DECLARE
  deleted_count bigint := 0;
BEGIN
  IF to_regclass(${regclassLiteral(target)}) IS NOT NULL THEN
    EXECUTE ${sqlLiteral(statement)};
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % row(s) from %', deleted_count, ${sqlLiteral(`${target.schema}.${target.table}`)};
  ELSE
    RAISE NOTICE 'Skipped % because table is not present', ${sqlLiteral(`${target.schema}.${target.table}`)};
  END IF;
END
$greenchoice_reset$;`;
}

function buildDryRunSql(targets) {
  return `
set client_min_messages to notice;

select
  n.nspname as schema_name,
  c.relname as table_name,
  obj_description(c.oid, 'pg_class') as description
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'storage')
  and c.relkind in ('r', 'p')
order by n.nspname, c.relname;

select
  child_ns.nspname || '.' || child.relname as child_table,
  parent_ns.nspname || '.' || parent.relname as parent_table,
  conname as constraint_name,
  pg_get_constraintdef(pg_constraint.oid) as definition
from pg_constraint
join pg_class child on child.oid = pg_constraint.conrelid
join pg_namespace child_ns on child_ns.oid = child.relnamespace
join pg_class parent on parent.oid = pg_constraint.confrelid
join pg_namespace parent_ns on parent_ns.oid = parent.relnamespace
where pg_constraint.contype = 'f'
  and (child_ns.nspname in ('public', 'storage') or parent_ns.nspname in ('public', 'storage'))
order by child_table, parent_table, constraint_name;

DO $greenchoice_reset$
DECLARE
  row_count bigint := 0;
BEGIN
  RAISE NOTICE 'GreenChoice safe reset dry-run counts. No rows are deleted.';
${targets.map(countBlock).join("\n")}
END
$greenchoice_reset$;
`.trim();
}

function immutableAuditGuardSql() {
  return `
DO $greenchoice_reset$
DECLARE
  audit_events_count bigint := 0;
  immutable_trigger_exists boolean := false;
BEGIN
  IF to_regclass('public.audit_events') IS NOT NULL THEN
    EXECUTE 'select count(*) from public.audit_events' INTO audit_events_count;
    SELECT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgrelid = 'public.audit_events'::regclass
        AND tgname = 'audit_events_no_update'
        AND NOT tgisinternal
        AND tgenabled <> 'D'
    ) INTO immutable_trigger_exists;

    IF audit_events_count > 0 AND immutable_trigger_exists THEN
      RAISE EXCEPTION 'public.audit_events has % row(s) and immutable trigger audit_events_no_update is enabled. Refusing to delete because changing triggers would be structural.', audit_events_count;
    END IF;
  END IF;
END
$greenchoice_reset$;`;
}

function ensureAdminProfilesSql({ adminUserId, email }) {
  return `
DO $greenchoice_reset$
DECLARE
  admin_id uuid := ${sqlUuid(adminUserId)};
  admin_email text := ${sqlLiteral(email)};
  staff_update_count bigint := 0;
  profile_update_count bigint := 0;
  columns text[];
  values text[];
  set_clauses text[];
BEGIN
  IF to_regclass('public.staff_profiles') IS NOT NULL THEN
    set_clauses := ARRAY[
      format('email = %L', admin_email),
      format('full_name = %L', ${sqlLiteral(ADMIN_DISPLAY_NAME)}),
      'role = ''admin''',
      'is_active = true',
      'updated_at = now()'
    ];

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_profiles' AND column_name = 'user_id') THEN
      set_clauses := array_append(set_clauses, format('user_id = %L::uuid', admin_id));
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_profiles' AND column_name = 'first_name') THEN
      set_clauses := array_append(set_clauses, format('first_name = %L', ${sqlLiteral(ADMIN_FIRST_NAME)}));
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_profiles' AND column_name = 'surname') THEN
      set_clauses := array_append(set_clauses, format('surname = %L', ${sqlLiteral(ADMIN_SURNAME)}));
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_profiles' AND column_name = 'store_id') THEN
      set_clauses := array_append(set_clauses, 'store_id = null');
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_profiles' AND column_name = 'account_status') THEN
      set_clauses := array_append(set_clauses, 'account_status = ''active''');
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_profiles' AND column_name = 'deleted_at') THEN
      set_clauses := array_append(set_clauses, 'deleted_at = null');
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_profiles' AND column_name = 'profile_setup_complete') THEN
      set_clauses := array_append(set_clauses, 'profile_setup_complete = false');
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_profiles' AND column_name = 'store_setup_complete') THEN
      set_clauses := array_append(set_clauses, 'store_setup_complete = false');
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_profiles' AND column_name = 'account_setup_complete') THEN
      set_clauses := array_append(set_clauses, 'account_setup_complete = false');
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_profiles' AND column_name = 'temporary_password_active') THEN
      set_clauses := array_append(set_clauses, 'temporary_password_active = false');
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_profiles' AND column_name = 'temporary_password_fingerprint') THEN
      set_clauses := array_append(set_clauses, 'temporary_password_fingerprint = null');
    END IF;

    EXECUTE format(
      'update public.staff_profiles set %s where auth_user_id = %L::uuid',
      array_to_string(set_clauses, ', '),
      admin_id
    );
    GET DIAGNOSTICS staff_update_count = ROW_COUNT;

    IF staff_update_count = 0 THEN
      columns := ARRAY['auth_user_id', 'email', 'full_name', 'role', 'is_active'];
      values := ARRAY[
        format('%L::uuid', admin_id),
        format('%L', admin_email),
        format('%L', ${sqlLiteral(ADMIN_DISPLAY_NAME)}),
        '''admin''',
        'true'
      ];

      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_profiles' AND column_name = 'user_id') THEN
        columns := array_append(columns, 'user_id');
        values := array_append(values, format('%L::uuid', admin_id));
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_profiles' AND column_name = 'first_name') THEN
        columns := array_append(columns, 'first_name');
        values := array_append(values, format('%L', ${sqlLiteral(ADMIN_FIRST_NAME)}));
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_profiles' AND column_name = 'surname') THEN
        columns := array_append(columns, 'surname');
        values := array_append(values, format('%L', ${sqlLiteral(ADMIN_SURNAME)}));
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_profiles' AND column_name = 'store_id') THEN
        columns := array_append(columns, 'store_id');
        values := array_append(values, 'null');
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_profiles' AND column_name = 'account_status') THEN
        columns := array_append(columns, 'account_status');
        values := array_append(values, '''active''');
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_profiles' AND column_name = 'profile_setup_complete') THEN
        columns := array_append(columns, 'profile_setup_complete');
        values := array_append(values, 'false');
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_profiles' AND column_name = 'store_setup_complete') THEN
        columns := array_append(columns, 'store_setup_complete');
        values := array_append(values, 'false');
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_profiles' AND column_name = 'account_setup_complete') THEN
        columns := array_append(columns, 'account_setup_complete');
        values := array_append(values, 'false');
      END IF;

      EXECUTE format(
        'insert into public.staff_profiles (%s) values (%s)',
        array_to_string(columns, ', '),
        array_to_string(values, ', ')
      );
      RAISE NOTICE 'Inserted admin staff_profiles row for %', admin_email;
    ELSE
      RAISE NOTICE 'Updated admin staff_profiles row for %', admin_email;
    END IF;
  END IF;

  IF to_regclass('public.profiles') IS NOT NULL THEN
    UPDATE public.profiles
    SET display_name = ${sqlLiteral(ADMIN_DISPLAY_NAME)},
        role = 'admin',
        status = 'active',
        updated_at = now()
    WHERE id = admin_id;
    GET DIAGNOSTICS profile_update_count = ROW_COUNT;

    IF profile_update_count = 0 THEN
      INSERT INTO public.profiles (id, display_name, role, status)
      VALUES (admin_id, ${sqlLiteral(ADMIN_DISPLAY_NAME)}, 'admin', 'active');
      RAISE NOTICE 'Inserted legacy public.profiles admin row for %', admin_email;
    ELSE
      RAISE NOTICE 'Updated legacy public.profiles admin row for %', admin_email;
    END IF;
  END IF;
END
$greenchoice_reset$;`;
}

function buildExecuteSql({ targets, adminUserId, email }) {
  return `
BEGIN;
SET LOCAL client_min_messages = notice;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';
SELECT pg_advisory_xact_lock(hashtext('greenchoice-safe-reset-keep-admin'));

${immutableAuditGuardSql()}

${targets.map(deleteBlock).join("\n")}

${ensureAdminProfilesSql({ adminUserId, email })}

COMMIT;
`.trim();
}

function pgEnvFromDatabaseUrl(databaseUrl) {
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("SUPABASE_DB_URL/DATABASE_URL must be a valid Postgres URL.");
  }

  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("SUPABASE_DB_URL/DATABASE_URL must use postgres:// or postgresql://.");
  }

  const env = {
    PGHOST: parsed.hostname,
    PGPORT: parsed.port || "5432",
    PGDATABASE: decodeURIComponent(parsed.pathname.replace(/^\//, "")),
    PGUSER: decodeURIComponent(parsed.username),
    PGPASSWORD: decodeURIComponent(parsed.password),
    PGSSLMODE: parsed.searchParams.get("sslmode") || "require"
  };

  if (parsed.searchParams.get("connect_timeout")) {
    env.PGCONNECT_TIMEOUT = parsed.searchParams.get("connect_timeout");
  }

  return env;
}

function runPsql(sql, label) {
  const databaseUrl = configuredValue("SUPABASE_DB_URL") || configuredValue("DATABASE_URL");
  if (!databaseUrl) {
    throw new Error("SUPABASE_DB_URL or DATABASE_URL is required for exact dry-run counts and execution.");
  }

  const tempDir = mkdtempSync(join(tmpdir(), "greenchoice-reset-"));
  const sqlFile = join(tempDir, `${label}.sql`);
  writeFileSync(sqlFile, sql, { mode: 0o600 });

  try {
    const result = spawnSync("psql", ["-v", "ON_ERROR_STOP=1", "-f", sqlFile], {
      encoding: "utf8",
      env: { ...process.env, ...pgEnvFromDatabaseUrl(databaseUrl) },
      stdio: ["ignore", "pipe", "pipe"]
    });

    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    if (result.error?.code === "ENOENT") {
      throw new Error("psql was not found. Install PostgreSQL client tools, then rerun this script.");
    }
    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      throw new Error(output || `psql exited with status ${result.status}`);
    }
    return output;
  } catch (error) {
    throw new Error(error.message);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function printStaticPlan() {
  console.log("GreenChoice safe reset plan");
  console.log("");
  console.log("Kept:");
  console.log("- The configured administrator Supabase Auth user");
  console.log("- One active public.staff_profiles row with role admin and no store_id");
  console.log("- One legacy public.profiles admin row if that table exists");
  console.log("- Tables, schemas, migrations, RLS policies, functions, storage buckets, and app code");
  console.log("");
  console.log("Deleted in dependency order:");
  for (const target of DELETE_TARGETS) {
    const suffix = target.table === "staff_profiles" ? " (except kept admin)" : target.table === "profiles" ? " (except kept admin)" : "";
    console.log(`- ${target.schema}.${target.table}${suffix}: ${target.reason}`);
  }
  console.log("");
  console.log("Preserved reference/structural records:");
  for (const table of PRESERVED_REFERENCE_TABLES) console.log(`- ${table}`);
  console.log("");
  console.log("Optional:");
  console.log(`- Pass --delete-product-storage-objects to delete storage.objects rows in buckets: ${PRODUCT_STORAGE_BUCKETS.join(", ")}`);
}

async function printRemotePlan(admin, email) {
  const [users, restSchema] = await Promise.all([listAuthUsers(admin), fetchRestSchema()]);
  const adminUsers = users.filter((user) => user.email?.toLowerCase() === email);
  const nonAdminUsers = users.filter((user) => user.email?.toLowerCase() !== email);
  const warnings = schemaWarnings(restSchema);

  console.log("");
  console.log("Remote Supabase inspection:");
  console.log(`- Public REST tables discovered: ${Object.keys(restSchema).sort().join(", ")}`);
  console.log(`- Auth users discovered: ${users.length}`);
  console.log(`- Admin Auth users matching ${email}: ${adminUsers.length}`);
  console.log(`- Non-admin Auth users that --execute will delete after DB transaction: ${nonAdminUsers.length}`);

  if (warnings.length > 0) {
    console.log("");
    console.log("Schema warnings (not changed by this reset script):");
    for (const warning of warnings) console.log(`- ${warning}`);
  }
}

async function deleteNonAdminAuthUsers(admin, adminUserId, execute) {
  const users = await listAuthUsers(admin);
  const toDelete = users.filter((user) => user.id !== adminUserId);
  if (!execute) {
    console.log(`- Non-admin Auth users that would be deleted: ${toDelete.length}`);
    return;
  }

  for (const user of toDelete) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw new Error(`Failed to delete non-admin Auth user ${user.id}: ${error.message}`);
    console.log(`Deleted non-admin Auth user: ${user.email ?? user.id}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  if (args.plan) {
    printStaticPlan();
    return;
  }

  loadLocalEnv();
  if ((process.env.GREENCHOICE_ENV ?? "").toLowerCase() !== "development") {
    throw new Error("The reset script refuses to run outside the development environment.");
  }
  if (args.execute && process.env.ALLOW_DESTRUCTIVE_LOCAL_SEED !== "true") {
    throw new Error("Set ALLOW_DESTRUCTIVE_LOCAL_SEED=true before an explicit local reset.");
  }
  const email = adminEmail();

  if (args.execute && args.confirmReset.toLowerCase() !== email) {
    throw new Error(`Refusing to execute. Pass --confirm-reset=${email}`);
  }

  const admin = createAdminClient();
  await printRemotePlan(admin, email);

  const adminAuth = await ensureAdminAuthUser(admin, email, args.execute);
  if (!adminAuth.user) {
    throw new Error(`Admin Auth user ${email} does not exist. To create it safely, rerun with --execute and ADMIN_INITIAL_PASSWORD or ADMIN_PASSWORD set.`);
  }

  const targets = targetsForRun({
    adminUserId: adminAuth.user.id,
    includeStorageObjects: args.deleteProductStorageObjects
  });
  const dryRunSql = buildDryRunSql(targets);
  const executeSql = buildExecuteSql({ targets, adminUserId: adminAuth.user.id, email });

  if (args.printSql) {
    console.log("");
    console.log("-- DRY RUN SQL");
    console.log(dryRunSql);
    console.log("");
    console.log("-- EXECUTE SQL");
    console.log(executeSql);
    return;
  }

  console.log("");
  console.log("Exact dry-run counts and FK inspection:");
  console.log(runPsql(dryRunSql, "dry-run"));
  await deleteNonAdminAuthUsers(admin, adminAuth.user.id, false);

  if (!args.execute) {
    console.log("");
    console.log("Dry run complete. No rows were deleted.");
    console.log(`To execute, rerun with: node scripts/safe-reset-keep-admin.mjs --execute --confirm-reset=${email}`);
    return;
  }

  console.log("");
  console.log("Executing database transaction...");
  console.log(runPsql(executeSql, "execute"));

  console.log("");
  console.log("Deleting non-admin Supabase Auth users...");
  await deleteNonAdminAuthUsers(admin, adminAuth.user.id, true);

  console.log("");
  console.log(`Safe reset complete. Kept admin login: ${email}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
