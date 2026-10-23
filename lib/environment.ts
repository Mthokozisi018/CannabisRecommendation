import "server-only";

export type GreenChoiceEnvironment = "development" | "staging" | "production";

// The dedicated staging Vercel project serves its staging branch as that project's
// production target. Its project ID keeps this exception isolated from GreenChoice production.
const STAGING_VERCEL_PROJECT_ID = "prj_lsDmicOEXf0xB3wV2hFvqSR82wBB";

export function greenChoiceEnvironment(): GreenChoiceEnvironment {
  const value = process.env.GREENCHOICE_ENV?.trim().toLowerCase();
  if (value === "development" || value === "staging" || value === "production") {
    if (process.env.NODE_ENV === "production" && value === "development") {
      throw new Error("A production-mode runtime cannot use the development environment identity.");
    }
    if (process.env.VERCEL_ENV === "preview" && value !== "staging") {
      throw new Error("A Vercel preview must use the staging environment identity.");
    }
    if (process.env.VERCEL_ENV === "production" && value !== "production"
      && !(value === "staging" && process.env.VERCEL_PROJECT_ID === STAGING_VERCEL_PROJECT_ID)) {
      throw new Error("A Vercel production deployment must use the production environment identity.");
    }
    return value;
  }
  if (!value && process.env.VERCEL_ENV === "preview") {
    return "staging";
  }
  if (!value && process.env.VERCEL_ENV === "production") {
    return "production";
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("GREENCHOICE_ENV must identify staging or production.");
  }
  return "development";
}

export function assertSupabaseEnvironmentIdentity() {
  const environment = greenChoiceEnvironment();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const expectedProjectRef = process.env.EXPECTED_SUPABASE_PROJECT_REF?.trim();
  const productionProjectRef = process.env.PRODUCTION_SUPABASE_PROJECT_REF?.trim();

  if (process.env.NODE_ENV !== "production" && environment === "development") return;
  if (!supabaseUrl || !expectedProjectRef) {
    throw new Error("Supabase environment identity is not configured.");
  }

  let actualProjectRef = "";
  try {
    const hostname = new URL(supabaseUrl).hostname;
    actualProjectRef = hostname.endsWith(".supabase.co") ? hostname.split(".")[0] ?? "" : "";
  } catch {
    throw new Error("Supabase URL configuration is invalid.");
  }
  if (!actualProjectRef || actualProjectRef !== expectedProjectRef) {
    throw new Error("Supabase project does not match the configured GreenChoice environment.");
  }
  if (environment === "staging" && (!productionProjectRef || actualProjectRef === productionProjectRef)) {
    throw new Error("Staging must use a Supabase project that is isolated from production.");
  }
  if (environment === "production" && productionProjectRef && actualProjectRef !== productionProjectRef) {
    throw new Error("Production must use the designated production Supabase project.");
  }
}

export function requireServerSecret(name: string, minimumLength = 32) {
  const value = process.env[name]?.trim();
  if (!value || value.length < minimumLength) {
    throw new Error(`${name} is not securely configured.`);
  }
  return value;
}

export function validateProductionEnvironment() {
  if (process.env.NODE_ENV !== "production") return;

  greenChoiceEnvironment();
  assertSupabaseEnvironmentIdentity();
  requireServerSecret("CSRF_SECRET");
  requireServerSecret("SESSION_SIGNING_SECRET");
  requireServerSecret("RATE_LIMIT_KEY_SECRET");
  requireServerSecret("READINESS_DIAGNOSTIC_SECRET");

  if (!process.env.SUPABASE_SECRET_KEY?.trim() && !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    throw new Error("A Supabase server secret is required.");
  }
  const hasRateLimitRedis = Boolean(
    (process.env.RATE_LIMIT_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_URL)?.trim() &&
    (process.env.RATE_LIMIT_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN)?.trim()
  );
  if (!hasRateLimitRedis) {
    throw new Error("Distributed rate limiting is required.");
  }

  const appUrl = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl || new URL(appUrl).protocol !== "https:") {
    throw new Error("A canonical HTTPS application URL is required.");
  }
}
