import { describe, expect, it } from "vitest";
// @ts-expect-error The environment validator is a runtime JavaScript module shared with npm scripts.
import { buildLocalEnvironment, validateLocalEnvironment } from "../../scripts/verify-local-environment.mjs";

const validEnvironment = {
  EXPECTED_SUPABASE_PROJECT_REF: "aaaaaaaaaaaaaaaaaaaa",
  PRODUCTION_SUPABASE_PROJECT_REF: "bbbbbbbbbbbbbbbbbbbb",
  NEXT_PUBLIC_SUPABASE_URL: "https://aaaaaaaaaaaaaaaaaaaa.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "staging-public-key",
  SUPABASE_SECRET_KEY: "staging-secret-key",
  CSRF_SECRET: "c".repeat(32),
  SESSION_SIGNING_SECRET: "s".repeat(32),
  STAFF_SESSION_SIGNING_SECRET: "t".repeat(32),
  GREENCHOICE_PASSWORD_FINGERPRINT_SECRET: "p".repeat(32),
  RATE_LIMIT_KEY_SECRET: "r".repeat(32)
};

describe("local staging environment isolation", () => {
  it("builds a customer-enabled, non-destructive localhost environment", () => {
    const environment = buildLocalEnvironment(validEnvironment);
    expect(validateLocalEnvironment(environment)).toEqual([]);
    expect(environment.GREENCHOICE_CUSTOMER_EXPERIENCE_ENABLED).toBe("true");
    expect(environment.GREENCHOICE_LOCAL_PENDING_ORDERS).toBe("true");
    expect(environment.ALLOW_DESTRUCTIVE_LOCAL_SEED).toBe("false");
  });

  it("rejects the production Supabase project", () => {
    const environment = buildLocalEnvironment({
      ...validEnvironment,
      NEXT_PUBLIC_SUPABASE_URL: "https://bbbbbbbbbbbbbbbbbbbb.supabase.co"
    });
    expect(validateLocalEnvironment(environment)).toEqual(expect.arrayContaining([
      "NEXT_PUBLIC_SUPABASE_URL must match EXPECTED_SUPABASE_PROJECT_REF.",
      "Local development must not use the production Supabase project."
    ]));
  });
});
