import "server-only";

export function paystackCheckoutCallbackUrl(env: Record<string, string | undefined> = process.env): string | null {
  const app = env.APP_URL?.trim().replace(/\/$/, "");
  const callback = env.PAYSTACK_CALLBACK_URL?.trim();
  if (!app || !callback || !["staging", "production"].includes(env.GREENCHOICE_ENV ?? "") || env.PAYSTACK_MODE !== "test"
    || env.PAYSTACK_BILLING_ENABLED !== "true" || !env.PAYSTACK_SECRET_KEY?.trim().startsWith("sk_test_")) {
    return null;
  }
  try {
    const origin = new URL(app);
    if (origin.protocol !== "https:" || origin.origin !== app
      || ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
      || callback !== `${app}/billing/payment/callback`) return null;
    return callback;
  } catch {
    return null;
  }
}
