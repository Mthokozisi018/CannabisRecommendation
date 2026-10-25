import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { parseEnvFile } from "./verify-local-environment.mjs";

const [envFile, expectedRef, bucket, outputDirectory, expectedCountText] = process.argv.slice(2);
if (!envFile || !/^[a-z0-9]{20}$/.test(expectedRef ?? "") || !/^[a-z0-9-]+$/.test(bucket ?? "")
  || !outputDirectory || !/^\d+$/.test(expectedCountText ?? "")) {
  throw new Error("Usage: node scripts/backup-supabase-storage.mjs <env-file> <project-ref> <bucket> <output-directory> <expected-object-count>");
}
const env = parseEnvFile(readFileSync(resolve(envFile), "utf8"));
const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
if (url.protocol !== "https:" || url.hostname !== `${expectedRef}.supabase.co`) {
  throw new Error("Supabase URL does not match the explicitly selected project.");
}
const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!key || key.includes("replace-with")) throw new Error("A server-only Supabase key is required.");
const client = createClient(url.origin, key, { auth: { persistSession: false, autoRefreshToken: false } });
const output = resolve(outputDirectory);
mkdirSync(output, { recursive: true });
const objects = [];

async function listAll(prefix = "") {
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.storage.from(bucket).list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`Storage listing failed: ${error.message}`);
    for (const entry of data ?? []) {
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) await listAll(name);
      else objects.push({ path: name, contentType: entry.metadata?.mimetype ?? null });
    }
    if ((data?.length ?? 0) < 1000) break;
  }
}

await listAll();
if (objects.length !== Number(expectedCountText)) {
  throw new Error(`Object count changed during backup preparation: expected ${expectedCountText}, found ${objects.length}.`);
}
const manifest = [];
for (const object of objects) {
  const { data, error } = await client.storage.from(bucket).download(object.path);
  if (error || !data) throw new Error(`Storage download failed for an object: ${error?.message ?? "no data"}`);
  const bytes = Buffer.from(await data.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const file = `${createHash("sha256").update(`${bucket}/${object.path}`).digest("hex")}.blob`;
  const destination = join(output, file);
  writeFileSync(destination, bytes, { flag: "wx", mode: 0o600 });
  if (statSync(destination).size !== bytes.length
    || createHash("sha256").update(readFileSync(destination)).digest("hex") !== sha256) {
    throw new Error("A downloaded object failed local integrity verification.");
  }
  manifest.push({ bucket, path: object.path, file, contentType: object.contentType, bytes: bytes.length, sha256 });
}
writeFileSync(join(output, "manifest.json"), JSON.stringify({ projectRef: expectedRef, bucket, capturedAt: new Date().toISOString(), objects: manifest }, null, 2), { flag: "wx", mode: 0o600 });
console.log(`Verified ${manifest.length} downloaded ${bucket} objects (${manifest.reduce((total, item) => total + item.bytes, 0)} bytes).`);
