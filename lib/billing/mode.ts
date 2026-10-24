import "server-only";

export type PaystackMode = "test" | "live";

export function configuredPaystackMode(env: Record<string, string | undefined> = process.env): PaystackMode | null {
  if (env.PAYSTACK_BILLING_ENABLED !== "true") return null;
  const environment = env.GREENCHOICE_ENV;
  const mode = env.PAYSTACK_MODE;
  const key = env.PAYSTACK_SECRET_KEY?.trim();
  if (environment === "staging" && mode === "test" && key?.startsWith("sk_test_")) return "test";
  if (environment === "production" && mode === "live" && key?.startsWith("sk_live_")) return "live";
  return null;
}
