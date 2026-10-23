import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const envPath = resolve(process.cwd(), ".env.staging.local");
const entryPath = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : "";

if (!existsSync(envPath)) throw new Error(`Staging environment file not found: ${envPath}`);
if (!entryPath || !existsSync(entryPath)) throw new Error("A valid Node.js entry file is required.");

const stagingEnv = {};
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
  const [key, ...rest] = trimmed.split("=");
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
  stagingEnv[key] = rest.join("=").trim().replace(/^(['"])(.*)\1$/, "$2");
}

const result = spawnSync(process.execPath, [entryPath, ...process.argv.slice(3)], {
  env: { ...process.env, ...stagingEnv },
  stdio: "inherit"
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
