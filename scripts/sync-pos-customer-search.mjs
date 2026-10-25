import { Client } from "@elastic/elasticsearch";
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildLocalEnvironment, parseEnvFile, validateLocalEnvironment } from "./verify-local-environment.mjs";

const requestedPath = process.env.GREENCHOICE_STAGING_ENV_FILE;
const candidates = requestedPath
  ? [resolve(process.cwd(), requestedPath)]
  : [resolve(process.cwd(), ".env.staging.local")];
const envPath = candidates.find((candidate) => existsSync(candidate));
if (!envPath) throw new Error("A local staging environment file is required. Set GREENCHOICE_STAGING_ENV_FILE if needed.");
const localEnv = buildLocalEnvironment(parseEnvFile(readFileSync(envPath, "utf8")));
const failures = validateLocalEnvironment(localEnv);
if (failures.length) throw new Error(`Invalid staging environment: ${failures.join(" ")}`);
Object.assign(process.env, localEnv);

const env = process.env;
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const expected = env.EXPECTED_SUPABASE_PROJECT_REF;
const production = env.PRODUCTION_SUPABASE_PROJECT_REF;
const actual = url ? new URL(url).hostname.split(".")[0] : "";
if (env.GREENCHOICE_ENV !== "staging" || !expected || actual !== expected || actual === production) {
  throw new Error("This command requires the verified staging Supabase environment.");
}
if (!env.ELASTICSEARCH_URL || !(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY)) {
  throw new Error("Set ELASTICSEARCH_URL and a staging Supabase server key.");
}
const endpoint = new URL(env.ELASTICSEARCH_URL);
const localEndpoint = ["127.0.0.1", "localhost", "::1"].includes(endpoint.hostname);
if (endpoint.username || endpoint.password || (!localEndpoint && (endpoint.protocol !== "https:" || !env.ELASTICSEARCH_API_KEY))) {
  throw new Error("Elasticsearch requires HTTPS and an API key outside localhost; URL credentials are not supported.");
}

const INDEX = "greenchoice_customers";
const elastic = new Client({
  node: env.ELASTICSEARCH_URL,
  ...(env.ELASTICSEARCH_API_KEY ? { auth: { apiKey: env.ELASTICSEARCH_API_KEY } } : {}),
  requestTimeout: 5000,
  maxRetries: 1
});
const db = createClient(url, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function ensureIndex() {
  if (await elastic.indices.exists({ index: INDEX })) return;
  await elastic.indices.create({
    index: INDEX,
    mappings: {
      dynamic: "strict",
      properties: {
        customer_id: { type: "keyword" }, store_id: { type: "keyword" },
        name: { type: "text" }, surname: { type: "text" }, full_name: { type: "text" },
        cellphone: { type: "keyword" }, phone_digits: { type: "keyword" }, created_at: { type: "date" }
      }
    }
  });
}

async function queueExisting() {
  let cursor = "00000000-0000-0000-0000-000000000000";
  let count = 0;
  while (true) {
    const { data, error } = await db.from("pos_customers").select("id").gt("id", cursor).order("id").limit(500);
    if (error) throw error;
    if (!data?.length) break;
    const queued = await db.from("pos_customer_search_outbox").upsert(data.map((row) => ({ customer_id: row.id, changed_at: new Date().toISOString() })), { onConflict: "customer_id" });
    if (queued.error) throw queued.error;
    count += data.length;
    cursor = data.at(-1).id;
  }
  console.log(`Queued ${count} customer records for indexing.`);
}

async function syncBatch(cursor) {
  const { data: changes, error } = await db.from("pos_customer_search_outbox")
    .select("customer_id,changed_at").gt("customer_id", cursor).order("customer_id").limit(100);
  if (error) throw error;
  if (!changes?.length) return { cursor, count: 0 };

  const ids = changes.map((change) => change.customer_id);
  const { data: rows, error: rowError } = await db.from("pos_customers")
    .select("id,store_id,first_name,surname,phone_display,phone_digits,created_at,deleted_at")
    .in("id", ids);
  if (rowError) throw rowError;
  const byId = new Map((rows || []).map((row) => [row.id, row]));
  const operations = changes.flatMap(({ customer_id: id }) => {
    const row = byId.get(id);
    if (!row || row.deleted_at) return [{ delete: { _index: INDEX, _id: id } }];
    return [
      { index: { _index: INDEX, _id: id } },
      {
        customer_id: id, store_id: row.store_id, name: row.first_name, surname: row.surname,
        full_name: `${row.first_name.trim()} ${row.surname.trim()}`,
        cellphone: row.phone_display || row.phone_digits,
        phone_digits: row.phone_digits, created_at: row.created_at
      }
    ];
  });
  const result = await elastic.bulk({ operations, refresh: "wait_for" });
  let completed = 0;
  for (const [index, change] of changes.entries()) {
    const item = result.items[index];
    const outcome = item?.index || item?.delete;
    if (!outcome || (outcome.status >= 300 && outcome.status !== 404)) {
      console.error("[customer-index] bulk item failed", { customerId: change.customer_id, error: outcome?.error });
      continue;
    }
    const { error: clearError } = await db.from("pos_customer_search_outbox")
      .delete().eq("customer_id", change.customer_id).eq("changed_at", change.changed_at);
    if (clearError) console.error("[customer-index] could not clear queued change", { customerId: change.customer_id, error: clearError });
    else completed += 1;
  }
  return { cursor: changes.at(-1).customer_id, count: completed };
}

async function runOnce() {
  let cursor = "00000000-0000-0000-0000-000000000000";
  let completed = 0;
  while (true) {
    const batch = await syncBatch(cursor);
    if (batch.cursor === cursor) break;
    cursor = batch.cursor;
    completed += batch.count;
  }
  console.log(`Synchronized ${completed} customer changes.`);
}

await ensureIndex();
if (process.argv.includes("--reindex")) await queueExisting();
if (process.argv.includes("--watch")) {
  while (true) {
    try { await runOnce(); } catch (error) { console.error("[customer-index] retrying after failure", error); }
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
} else {
  await runOnce();
}
