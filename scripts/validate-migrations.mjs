import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const migrationDir = resolve(root, "supabase", "migrations");
const migrationNames = readdirSync(migrationDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

const failures = [];
const timestamps = new Set();

for (const name of migrationNames) {
  const match = /^(\d{14})_[a-z0-9_]+\.sql$/.exec(name);
  if (!match) {
    failures.push(`${name}: filename must use a 14-digit timestamp and snake_case description`);
    continue;
  }
  if (timestamps.has(match[1])) failures.push(`${name}: duplicate migration timestamp ${match[1]}`);
  timestamps.add(match[1]);

  const sql = readFileSync(resolve(migrationDir, name), "utf8");
  if (name >= "20260729120000") {
    const functionBlocks = sql.match(/create\s+or\s+replace\s+function[\s\S]*?\$\$\s*;/gi) ?? [];
    for (const block of functionBlocks) {
      if (/security\s+definer/i.test(block) &&
          !/set\s+search_path\s*=\s*pg_catalog\s*,\s*public/i.test(block)) {
        const functionName = /function\s+([a-z0-9_.]+)/i.exec(block)?.[1] ?? "unknown function";
        failures.push(`${name}: ${functionName} is SECURITY DEFINER without a fixed pg_catalog, public search_path`);
      }
    }
  }
}

function requireText(file, snippets) {
  const source = readFileSync(resolve(root, file), "utf8");
  for (const snippet of snippets) {
    if (!source.includes(snippet)) failures.push(`${file}: missing required security contract: ${snippet}`);
  }
}

requireText("supabase/migrations/20260729120000_critical_authorization_hardening.sql", [
  "invitation_row.auth_user_id is distinct from caller_id",
  "pg_advisory_xact_lock(hashtextextended(invitation_row.store_id::text, 0))",
  "revoke all on function public.complete_receptionist_sale(uuid, uuid, jsonb)",
  "grant execute on function public.complete_receptionist_sale_v2(uuid, uuid, jsonb) to service_role",
  "resolved_status := coalesce(",
  "manager_store_registration_preserved_restriction"
]);
requireText("supabase/migrations/20260729121000_store_scoped_audit_rls.sql", [
  "store_id = public.current_staff_store_id()",
  "set search_path = pg_catalog, public"
]);
requireText("supabase/migrations/20260729122000_atomic_inventory.sql", [
  "for update",
  "add_inventory_stock_atomic"
]);
requireText("supabase/migrations/20260729124000_harden_product_image_storage.sql", [
  "file_size_limit = 6291456",
  "allowed_mime_types = array['image/webp']::text[]",
  "drop policy if exists product_images_storage_manager_write on storage.objects"
]);
requireText("supabase/migrations/20260729128000_least_privilege_rls_and_function_hardening.sql", [
  "revoke insert, update, delete on table public.staff_profiles from authenticated",
  "revoke insert, update, delete on table public.audit_logs from authenticated",
  "create policy audit_events_authorized_read",
  "alter function public.validate_staff_invitation_write()",
  "set search_path = pg_catalog, public"
]);
requireText("supabase/migrations/20260729129000_atomic_receptionist_status_and_slot_enforcement.sql", [
  "denial_reason := 'receptionist_slot_limit_reached'",
  "for update",
  "p_account_status in ('active', 'restricted')"
]);

if (failures.length > 0) {
  console.error(`Migration validation failed (${failures.length} issue${failures.length === 1 ? "" : "s"}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Migration validation passed for ${migrationNames.length} forward migrations.`);
}
