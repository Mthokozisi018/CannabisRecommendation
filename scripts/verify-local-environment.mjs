import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const requiredSecrets = [
  "CSRF_SECRET",
  "SESSION_SIGNING_SECRET",
  "STAFF_SESSION_SIGNING_SECRET",
  "GREENCHOICE_PASSWORD_FINGERPRINT_SECRET",
  "RATE_LIMIT_KEY_SECRET"
];

export function parseEnvFile(content) {
  const values = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    values[key] = rest.join("=").trim().replace(/^(['"])(.*)\1$/, "$2");
  }
  return values;
}

function isPlaceholder(value) {
  return !value || /replace-with|your-|placeholder/i.test(value);
}

function firstConfigured(...values) {
  return values.map((value) => value?.trim() ?? "").find((value) => !isPlaceholder(value)) ?? "";
}

function projectRefFromUrl(value) {
  try {
    const hostname = new URL(value).hostname;
    return hostname.endsWith(".supabase.co") ? hostname.split(".")[0] ?? "" : "";
  } catch {
    return "";
  }
}

function normalizeOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

export function buildLocalEnvironment(env, options = {}) {
  const origin = normalizeOrigin(options.origin ?? process.env.GREENCHOICE_LOCAL_ORIGIN ?? "http://127.0.0.1:3002");
  const companion = origin.replace("127.0.0.1", "localhost");
  return {
    ...env,
    GREENCHOICE_ENV: "staging",
    APP_URL: origin,
    NEXT_PUBLIC_APP_URL: origin,
    ALLOWED_ORIGINS: [origin, companion].filter(Boolean).join(","),
    GREENCHOICE_CUSTOMER_EXPERIENCE_ENABLED: "true",
    GREENCHOICE_LOCAL_PENDING_ORDERS: "true",
    ALLOW_ADMIN_BOOTSTRAP: "false",
    ALLOW_DESTRUCTIVE_LOCAL_SEED: "false"
  };
}

export function validateLocalEnvironment(env) {
  const failures = [];
  const stagingRef = env.EXPECTED_SUPABASE_PROJECT_REF?.trim() ?? "";
  const productionRef = env.PRODUCTION_SUPABASE_PROJECT_REF?.trim() ?? "";
  const actualRef = projectRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL ?? "");

  if (env.GREENCHOICE_ENV !== "staging") failures.push("Local development must use the staging environment identity.");
  if (!/^[a-z0-9]{20}$/.test(stagingRef)) failures.push("EXPECTED_SUPABASE_PROJECT_REF must identify staging.");
  if (!/^[a-z0-9]{20}$/.test(productionRef)) failures.push("PRODUCTION_SUPABASE_PROJECT_REF must identify production.");
  if (!actualRef || actualRef !== stagingRef) failures.push("NEXT_PUBLIC_SUPABASE_URL must match EXPECTED_SUPABASE_PROJECT_REF.");
  if (actualRef && actualRef === productionRef) failures.push("Local development must not use the production Supabase project.");
  if (!firstConfigured(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) failures.push("A staging Supabase public key is required.");
  if (!firstConfigured(env.SUPABASE_SECRET_KEY, env.SUPABASE_SERVICE_ROLE_KEY)) failures.push("A staging Supabase server key is required.");
  if (!/^http:\/\/(127\.0\.0\.1|localhost):3002$/.test(env.APP_URL ?? "") || env.APP_URL !== env.NEXT_PUBLIC_APP_URL) failures.push("Local URLs must use http://127.0.0.1:3002 (or localhost:3002).");
  if (!(env.ALLOWED_ORIGINS ?? "").split(",").includes(env.APP_URL)) failures.push("ALLOWED_ORIGINS must include APP_URL.");
  for (const name of requiredSecrets) {
    if (isPlaceholder(env[name]) || env[name].trim().length < 32) failures.push(`${name} must contain at least 32 characters.`);
  }
  if (env.GREENCHOICE_CUSTOMER_EXPERIENCE_ENABLED !== "true") failures.push("Customer ordering must be enabled locally.");
  if (env.GREENCHOICE_LOCAL_PENDING_ORDERS !== "true") failures.push("Pending Orders must be enabled locally.");
  if (env.ALLOW_ADMIN_BOOTSTRAP !== "false") failures.push("ALLOW_ADMIN_BOOTSTRAP must remain false.");
  if (env.ALLOW_DESTRUCTIVE_LOCAL_SEED !== "false") failures.push("ALLOW_DESTRUCTIVE_LOCAL_SEED must remain false.");
  return failures;
}

function run() {
  const requestedPath = process.argv[2] ?? process.env.GREENCHOICE_STAGING_ENV_FILE;
  const candidates = requestedPath
    ? [resolve(process.cwd(), requestedPath)]
    : [
        resolve(process.cwd(), ".env.staging.local"),
        resolve(process.cwd(), "../greenchoice-production-hardening/.env.staging.local")
      ];
  const envPath = candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
  if (!existsSync(envPath)) throw new Error(`Local staging environment file not found: ${envPath}`);
  const failures = validateLocalEnvironment(buildLocalEnvironment(parseEnvFile(readFileSync(envPath, "utf8"))));
  if (failures.length) {
    console.error(`Local environment verification failed (${failures.length} issues):`);
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
    return;
  }
  console.log("Local environment verified: isolated staging Supabase, customer ordering enabled, destructive operations disabled.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) run();
