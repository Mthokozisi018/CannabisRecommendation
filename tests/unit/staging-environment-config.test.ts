import { describe, expect, it } from "vitest";
import { validateStagingEnvironment } from "../../scripts/verify-staging-environment.mjs";

const validEnvironment = {
  GREENCHOICE_ENV: "staging",
  EXPECTED_SUPABASE_PROJECT_REF: "aaaaaaaaaaaaaaaaaaaa",
  PRODUCTION_SUPABASE_PROJECT_REF: "bbbbbbbbbbbbbbbbbbbb",
  GREENCHOICE_CUSTOMER_EXPERIENCE_ENABLED: "true",
  APP_URL: "https://greenchoice-staging.vercel.app",
  NEXT_PUBLIC_APP_URL: "https://greenchoice-staging.vercel.app",
  ALLOWED_ORIGINS: "https://greenchoice-staging.vercel.app",
  NEXT_PUBLIC_SUPABASE_URL: "https://aaaaaaaaaaaaaaaaaaaa.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "staging-public-key",
  SUPABASE_SECRET_KEY: "staging-server-key",
  CSRF_SECRET: "a".repeat(32),
  SESSION_SIGNING_SECRET: "b".repeat(32),
  STAFF_SESSION_SIGNING_SECRET: "c".repeat(32),
  GREENCHOICE_PASSWORD_FINGERPRINT_SECRET: "d".repeat(32),
  RATE_LIMIT_KEY_SECRET: "e".repeat(32),
  READINESS_DIAGNOSTIC_SECRET: "f".repeat(32),
  RATE_LIMIT_REDIS_REST_URL: "https://staging-redis.example.com",
  RATE_LIMIT_REDIS_REST_TOKEN: "staging-redis-token",
  ALLOW_ADMIN_BOOTSTRAP: "false",
  ALLOW_DESTRUCTIVE_LOCAL_SEED: "false",
  PAYSTACK_BILLING_ENABLED: "true",
  PAYSTACK_MODE: "test",
  PAYSTACK_SECRET_KEY: "sk_test_fixture_not_a_real_key",
  PAYSTACK_CALLBACK_URL: "https://greenchoice-staging.vercel.app/billing/payment/callback",
  PAYSTACK_WEBHOOK_URL: "https://greenchoice-staging.vercel.app/api/payments/paystack/webhook"
};

describe("staging environment verification", () => {
  it("accepts an isolated staging configuration", () => {
    expect(validateStagingEnvironment(validEnvironment)).toEqual([]);
  });

  it("accepts configured fallback credentials when primary fields retain example placeholders", () => {
    expect(validateStagingEnvironment({
      ...validEnvironment,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "replace-with-staging-publishable-key-if-used",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "staging-legacy-anon-key",
      SUPABASE_SECRET_KEY: "replace-with-staging-secret-key-if-used",
      SUPABASE_SERVICE_ROLE_KEY: "staging-service-role-key",
      RATE_LIMIT_REDIS_REST_URL: "https://your-staging-redis-endpoint.example.com",
      RATE_LIMIT_REDIS_REST_TOKEN: "replace-with-staging-redis-token",
      UPSTASH_REDIS_REST_URL: "https://staging-redis.example.com",
      UPSTASH_REDIS_REST_TOKEN: "staging-upstash-token"
    })).toEqual([]);
  });

  it("rejects the production Supabase project in staging", () => {
    const failures = validateStagingEnvironment({
      ...validEnvironment,
      EXPECTED_SUPABASE_PROJECT_REF: validEnvironment.PRODUCTION_SUPABASE_PROJECT_REF,
      NEXT_PUBLIC_SUPABASE_URL: `https://${validEnvironment.PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`
    });
    expect(failures).toContain("Staging and production Supabase project refs must differ.");
  });

  it("keeps customer experience enabled while destructive operations stay disabled", () => {
    const failures = validateStagingEnvironment({
      ...validEnvironment,
      GREENCHOICE_CUSTOMER_EXPERIENCE_ENABLED: "false",
      ALLOW_ADMIN_BOOTSTRAP: "true",
      ALLOW_DESTRUCTIVE_LOCAL_SEED: "true"
    });
    expect(failures).toEqual(expect.arrayContaining([
      "GREENCHOICE_CUSTOMER_EXPERIENCE_ENABLED must be true in staging for restored customer ordering tests.",
      "ALLOW_ADMIN_BOOTSTRAP must remain false until a deliberate one-time staging bootstrap.",
      "ALLOW_DESTRUCTIVE_LOCAL_SEED must remain false for remote staging."
    ]));
  });

  it("rejects live Paystack credentials and off-origin callbacks", () => {
    const failures = validateStagingEnvironment({
      ...validEnvironment,
      PAYSTACK_SECRET_KEY: "sk_live_forbidden",
      PAYSTACK_CALLBACK_URL: "https://production.example.com/billing/payment/callback"
    });
    expect(failures).toContain("Paystack billing requires a staging-only test secret and PAYSTACK_MODE=test.");
    expect(failures).toContain("PAYSTACK_CALLBACK_URL must use the configured staging origin and route.");
  });

  it("rejects missing callback and webhook URLs while billing is enabled", () => {
    const failures = validateStagingEnvironment({
      ...validEnvironment,
      PAYSTACK_CALLBACK_URL: "",
      PAYSTACK_WEBHOOK_URL: ""
    });
    expect(failures).toContain("PAYSTACK_CALLBACK_URL must use the configured staging origin and route.");
    expect(failures).toContain("PAYSTACK_WEBHOOK_URL must use the configured staging origin and route.");
  });

  it("allows missing Paystack endpoints when billing is disabled", () => {
    expect(validateStagingEnvironment({
      ...validEnvironment,
      PAYSTACK_BILLING_ENABLED: "false",
      PAYSTACK_CALLBACK_URL: "",
      PAYSTACK_WEBHOOK_URL: ""
    })).toEqual([]);
  });
});
