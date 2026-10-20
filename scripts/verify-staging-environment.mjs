import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const requiredSecrets = [
  "CSRF_SECRET",
  "SESSION_SIGNING_SECRET",
  "STAFF_SESSION_SIGNING_SECRET",
  "GREENCHOICE_PASSWORD_FINGERPRINT_SECRET",
  "RATE_LIMIT_KEY_SECRET",
  "READINESS_DIAGNOSTIC_SECRET"
];

function parseEnvFile(content) {
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

function httpsOrigin(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === value.replace(/\/$/, "") ? url.origin : "";
  } catch {
    return "";
  }
}

export function validateStagingEnvironment(env) {
  const failures = [];
  const stagingRef = env.EXPECTED_SUPABASE_PROJECT_REF?.trim() ?? "";
  const productionRef = env.PRODUCTION_SUPABASE_PROJECT_REF?.trim() ?? "";

  if (env.GREENCHOICE_ENV?.trim().toLowerCase() !== "staging") {
    failures.push("GREENCHOICE_ENV must be staging.");
  }
  if (isPlaceholder(stagingRef) || !/^[a-z0-9]{20}$/.test(stagingRef)) {
    failures.push("EXPECTED_SUPABASE_PROJECT_REF must be a real staging project ref.");
  }
  if (isPlaceholder(productionRef) || !/^[a-z0-9]{20}$/.test(productionRef)) {
    failures.push("PRODUCTION_SUPABASE_PROJECT_REF must identify production for the isolation guard.");
  }
  if (stagingRef && productionRef && stagingRef === productionRef) {
    failures.push("Staging and production Supabase project refs must differ.");
  }
  if (projectRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL ?? "") !== stagingRef) {
    failures.push("NEXT_PUBLIC_SUPABASE_URL must match EXPECTED_SUPABASE_PROJECT_REF.");
  }
  if (!firstConfigured(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    failures.push("A staging Supabase publishable or anon key is required.");
  }
  if (!firstConfigured(env.SUPABASE_SECRET_KEY, env.SUPABASE_SERVICE_ROLE_KEY)) {
    failures.push("A staging Supabase server key is required.");
  }

  const appOrigin = httpsOrigin(env.APP_URL ?? "");
  const publicAppOrigin = httpsOrigin(env.NEXT_PUBLIC_APP_URL ?? "");
  if (!appOrigin || appOrigin !== publicAppOrigin) {
    failures.push("APP_URL and NEXT_PUBLIC_APP_URL must be the same HTTPS staging origin.");
  }
  const allowedOrigins = (env.ALLOWED_ORIGINS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  if (!appOrigin || !allowedOrigins.includes(appOrigin)) {
    failures.push("ALLOWED_ORIGINS must include the staging application origin.");
  }

  for (const name of requiredSecrets) {
    const value = env[name]?.trim() ?? "";
    if (isPlaceholder(value) || value.length < 32) failures.push(`${name} must be an independent staging secret of at least 32 characters.`);
  }
  const redisUrl = firstConfigured(env.RATE_LIMIT_REDIS_REST_URL, env.UPSTASH_REDIS_REST_URL);
  const redisToken = firstConfigured(env.RATE_LIMIT_REDIS_REST_TOKEN, env.UPSTASH_REDIS_REST_TOKEN);
  if (!redisUrl || !redisToken) {
    failures.push("Staging Redis URL and token are required for distributed rate limiting.");
  }
  if (env.GREENCHOICE_CUSTOMER_EXPERIENCE_ENABLED?.trim().toLowerCase() !== "true") {
    failures.push("GREENCHOICE_CUSTOMER_EXPERIENCE_ENABLED must be true in staging for restored customer ordering tests.");
  }
  if (env.ALLOW_ADMIN_BOOTSTRAP?.trim().toLowerCase() !== "false") {
    failures.push("ALLOW_ADMIN_BOOTSTRAP must remain false until a deliberate one-time staging bootstrap.");
  }
  if (env.ALLOW_DESTRUCTIVE_LOCAL_SEED?.trim().toLowerCase() !== "false") {
    failures.push("ALLOW_DESTRUCTIVE_LOCAL_SEED must remain false for remote staging.");
  }

  if (env.PAYSTACK_BILLING_ENABLED?.trim().toLowerCase() === "true") {
    if (env.PAYSTACK_MODE?.trim().toLowerCase() !== "test" || !env.PAYSTACK_SECRET_KEY?.trim().startsWith("sk_test_")) {
      failures.push("Paystack billing requires a staging-only test secret and PAYSTACK_MODE=test.");
    }
    for (const [name, path] of [["PAYSTACK_CALLBACK_URL", "/billing/payment/callback"], ["PAYSTACK_WEBHOOK_URL", "/api/payments/paystack/webhook"]]) {
      const value = env[name]?.trim();
      if (value && value !== `${appOrigin}${path}`) failures.push(`${name} must use the configured staging origin and route.`);
    }
  }

  return failures;
}

function run() {
  const envPath = resolve(process.cwd(), process.argv[2] ?? ".env.staging.local");
  if (!existsSync(envPath)) throw new Error(`Staging environment file not found: ${envPath}`);
  const failures = validateStagingEnvironment(parseEnvFile(readFileSync(envPath, "utf8")));
  if (failures.length > 0) {
    console.error(`Staging environment verification failed (${failures.length} issue${failures.length === 1 ? "" : "s"}):`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log("Staging environment verification passed; production isolation and disabled destructive operations are enforced.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) run();
