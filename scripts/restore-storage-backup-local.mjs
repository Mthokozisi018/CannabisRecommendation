import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";

const [backupDirectory, targetDirectory] = process.argv.slice(2);
if (!backupDirectory || !targetDirectory) throw new Error("Usage: node scripts/restore-storage-backup-local.mjs <backup-directory> <isolated-target-directory>");
const source = resolve(backupDirectory);
const target = resolve(targetDirectory);
if (target === source || target.startsWith(`${source}${sep}`)) throw new Error("Restore target must be separate from the backup.");
const manifest = JSON.parse(readFileSync(join(source, "manifest.json"), "utf8"));
if (!Array.isArray(manifest.objects) || !/^[a-z0-9-]+$/.test(manifest.bucket ?? "")) throw new Error("Invalid Storage backup manifest.");
const restored = new Set();
for (const object of manifest.objects) {
  if (object.bucket !== manifest.bucket || !/^[a-f0-9]{64}\.blob$/.test(object.file ?? "")
    || !/^[a-f0-9]{64}$/.test(object.sha256 ?? "")) throw new Error("Invalid Storage object manifest entry.");
  const parts = String(object.path).split("/");
  if (parts.some(part => !part || part === "." || part === ".." || /[<>:"\\|?*]/.test(part))) throw new Error("Unsafe Storage object path.");
  const destination = resolve(target, manifest.bucket, ...parts);
  if (!destination.startsWith(`${target}${sep}`) || restored.has(destination)) throw new Error("Unsafe or duplicate restore destination.");
  restored.add(destination);
  const bytes = readFileSync(join(source, object.file));
  if (bytes.length !== object.bytes || createHash("sha256").update(bytes).digest("hex") !== object.sha256) {
    throw new Error("Backup object failed integrity verification.");
  }
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, bytes, { flag: "wx", mode: 0o600 });
  if (createHash("sha256").update(readFileSync(destination)).digest("hex") !== object.sha256) {
    throw new Error("Restored object failed integrity verification.");
  }
}
console.log(`Restored and verified ${restored.size} objects into an isolated local directory.`);
