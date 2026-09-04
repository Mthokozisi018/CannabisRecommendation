import "server-only";
import crypto from "crypto";

export const STRIPE_API_VERSION = "2026-07-29.dahlia";

type StripePrimitive = string | number | boolean;
type StripeParams = Record<string, StripePrimitive | null | undefined>;
export type StripeObject = Record<string, unknown>;

function requiredSecret(name: "STRIPE_SECRET_KEY" | "STRIPE_WEBHOOK_SECRET") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function encodeParams(params: StripeParams) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    body.set(key, String(value));
  }
  return body;
}

function randomLetters(length: number) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export class StripeClient {
  private readonly apiBase = "https://api.stripe.com/v1";

  private async request<T extends StripeObject>(path: string, params: StripeParams) {
    const response = await fetch(`${this.apiBase}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requiredSecret("STRIPE_SECRET_KEY")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Stripe-Version": STRIPE_API_VERSION
      },
      body: encodeParams(params),
      cache: "no-store"
    });

    const payload = await response.json() as StripeObject;
    if (!response.ok) {
      const error = payload.error as Record<string, unknown> | undefined;
      const message = typeof error?.message === "string" ? error.message : "Stripe request failed.";
      throw new Error(message);
    }
    return payload as T;
  }

  createCustomer(input: { email: string; name: string; storeId: string; managerAuthUserId: string }) {
    return this.request<StripeObject>("/customers", {
      email: input.email,
      name: input.name,
      "metadata[app]": "greenchoice",
      "metadata[greenchoice_store_id]": input.storeId,
      "metadata[greenchoice_manager_auth_user_id]": input.managerAuthUserId
    });
  }

  createSubscriptionCheckout(input: {
    customerId: string;
    priceId: string;
    storeId: string;
    managerAuthUserId: string;
    successUrl: string;
    cancelUrl: string;
    trialEndUnix?: number;
  }) {
    return this.request<StripeObject>("/checkout/sessions", {
      mode: "subscription",
      customer: input.customerId,
      client_reference_id: input.storeId,
      "line_items[0][price]": input.priceId,
      "line_items[0][quantity]": 1,
      payment_method_collection: "always",
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      integration_identifier: `greenchoice_sub_${randomLetters(8)}`,
      "metadata[app]": "greenchoice",
      "metadata[greenchoice_store_id]": input.storeId,
      "metadata[greenchoice_manager_auth_user_id]": input.managerAuthUserId,
      "subscription_data[metadata][app]": "greenchoice",
      "subscription_data[metadata][greenchoice_store_id]": input.storeId,
      "subscription_data[metadata][greenchoice_manager_auth_user_id]": input.managerAuthUserId,
      "subscription_data[trial_end]": input.trialEndUnix
    });
  }

  createPortalSession(input: { customerId: string; returnUrl: string }) {
    return this.request<StripeObject>("/billing_portal/sessions", {
      customer: input.customerId,
      return_url: input.returnUrl
    });
  }
}

export const stripeClient = new StripeClient();

export function stripeStringId(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "string") {
    return (value as { id: string }).id;
  }
  return null;
}

export function verifyStripeWebhook(payload: string, signatureHeader: string | null) {
  if (!signatureHeader) throw new Error("Missing Stripe signature.");
  const parts = signatureHeader.split(",").map((part) => part.trim());
  const timestampPart = parts.find((part) => part.startsWith("t="));
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  const timestamp = Number(timestampPart?.slice(2));
  if (!Number.isFinite(timestamp) || signatures.length === 0) throw new Error("Invalid Stripe signature.");

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (ageSeconds > 300) throw new Error("Expired Stripe signature.");

  const expected = crypto
    .createHmac("sha256", requiredSecret("STRIPE_WEBHOOK_SECRET"))
    .update(`${timestamp}.${payload}`, "utf8")
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "utf8");
  const valid = signatures.some((signature) => {
    const receivedBuffer = Buffer.from(signature, "utf8");
    return receivedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
  });
  if (!valid) throw new Error("Invalid Stripe signature.");
}
