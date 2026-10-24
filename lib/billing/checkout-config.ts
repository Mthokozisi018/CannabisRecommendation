import "server-only";
import { configuredPaystackMode } from "./mode";

export function paystackCheckoutCallbackUrl(env: Record<string, string | undefined> = process.env): string | null {
  const app = env.APP_URL?.trim().replace(/\/$/, "");
  const callback = env.PAYSTACK_CALLBACK_URL?.trim();
  if (!app || !callback || !configuredPaystackMode(env)) {
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
