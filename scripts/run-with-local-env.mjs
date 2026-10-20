import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { buildLocalEnvironment, parseEnvFile, validateLocalEnvironment } from "./verify-local-environment.mjs";

const requestedPath = process.env.GREENCHOICE_STAGING_ENV_FILE;
const candidates = requestedPath
  ? [resolve(process.cwd(), requestedPath)]
  : [
      resolve(process.cwd(), ".env.staging.local")
    ];
const envPath = candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
const entryPath = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : "";
if (!existsSync(envPath)) throw new Error(`Local staging environment file not found: ${envPath}`);
if (!entryPath || !existsSync(entryPath)) throw new Error("A valid Node.js entry file is required.");

const localEnv = buildLocalEnvironment(parseEnvFile(readFileSync(envPath, "utf8")));
const failures = validateLocalEnvironment(localEnv);
if (failures.length) {
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

const result = spawnSync(process.execPath, [entryPath, ...process.argv.slice(3)], {
  env: { ...process.env, ...localEnv },
  stdio: "inherit"
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
