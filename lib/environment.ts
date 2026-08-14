import "server-only";

export type GreenChoiceEnvironment = "development" | "staging" | "production";

export function greenChoiceEnvironment(): GreenChoiceEnvironment {
  const value = process.env.GREENCHOICE_ENV?.trim().toLowerCase();
  if (value === "development" || value === "staging" || value === "production") {
    if (process.env.NODE_ENV === "production" && value === "development") {
      throw new Error("A production-mode runtime cannot use the development environment identity.");
    }
    return value;
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

  if (!process.env.SUPABASE_SECRET_KEY?.trim() && !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    throw new Error("A Supabase server secret is required.");
  }
  if (!process.env.RATE_LIMIT_REDIS_REST_URL?.trim() || !process.env.RATE_LIMIT_REDIS_REST_TOKEN?.trim()) {
    throw new Error("Distributed rate limiting is required.");
  }

  const appUrl = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl || new URL(appUrl).protocol !== "https:") {
    throw new Error("A canonical HTTPS application URL is required.");
  }
}
