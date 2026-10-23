import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const PAYSTACK_API_URL = "https://api.paystack.co";

type PaystackEnvelope<T> = { status: boolean; message?: string; data?: T };
type InitializedTransaction = { authorization_url: string; access_code: string; reference: string };

export type VerifiedTransaction = {
  id: number;
  domain: string;
  status: string;
  reference: string;
  amount: number;
  currency: string;
  paid_at?: string | null;
  metadata?: { greenchoice_billing_id?: string } | string | null;
  customer?: { customer_code?: string; email?: string };
  authorization?: { authorization_code?: string; reusable?: boolean; last4?: string; brand?: string; channel?: string };
};

function paystackTestKey() {
  if (process.env.PAYSTACK_MODE !== "test"
    || !["staging", "production"].includes(process.env.GREENCHOICE_ENV ?? "")) {
    throw new Error("Paystack test mode is not configured.");
  }
  const key = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!key?.startsWith("sk_test_")) throw new Error("A Paystack test secret key is required.");
  return key;
}

async function paystackRequest<T>(path: string, body?: Record<string, unknown>, method?: "GET" | "POST" | "PUT", allowEmptyData = false): Promise<T> {
  const response = await fetch(`${PAYSTACK_API_URL}${path}`, {
    method: method ?? (body ? "POST" : "GET"),
    headers: { Authorization: `Bearer ${paystackTestKey()}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Paystack is temporarily unavailable.");
  const payload = await response.json() as PaystackEnvelope<T>;
  if (!payload.status || (!payload.data && !allowEmptyData)) throw new Error("Paystack did not complete the request.");
  return payload.data as T;
}

export async function initializePaystackCheckout(input: {
  email: string;
  amountCents: number;
  reference: string;
  callbackUrl: string;
  billingId: string;
}) {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) throw new Error("Invalid billing amount.");
  if (!/^[a-zA-Z0-9.=-]+$/.test(input.reference)) throw new Error("Invalid payment reference.");
  const callback = new URL(input.callbackUrl);
  if (callback.protocol !== "https:") {
    throw new Error("A secure Paystack callback URL is required.");
  }
  const result = await paystackRequest<InitializedTransaction>("/transaction/initialize", {
    email: input.email,
    amount: input.amountCents,
    currency: "ZAR",
    reference: input.reference,
    callback_url: callback.toString(),
    channels: ["card"],
    metadata: JSON.stringify({ greenchoice_billing_id: input.billingId }),
  });
  const destination = new URL(result.authorization_url);
  if (destination.protocol !== "https:" || destination.hostname !== "checkout.paystack.com" || result.reference !== input.reference) {
    throw new Error("Paystack returned an invalid checkout session.");
  }
  return destination.toString();
}

export async function verifyPaystackTransaction(reference: string) {
  if (!/^[a-zA-Z0-9.=-]+$/.test(reference)) throw new Error("Invalid payment reference.");
  return paystackRequest<VerifiedTransaction>(`/transaction/verify/${encodeURIComponent(reference)}`);
}

export function paymentMatchesExpected(transaction: VerifiedTransaction, expected: { reference: string; amountCents: number; billingId?: string; payerEmail?: string }) {
  let metadata = transaction.metadata;
  if (typeof metadata === "string") {
    try { metadata = JSON.parse(metadata) as { greenchoice_billing_id?: string }; } catch { return false; }
  }
  return transaction.domain === "test"
    && transaction.status === "success"
    && transaction.reference === expected.reference
    && transaction.amount === expected.amountCents
    && transaction.currency === "ZAR"
    && (!expected.billingId || metadata?.greenchoice_billing_id === expected.billingId)
    && (!expected.payerEmail || transaction.customer?.email?.toLowerCase() === expected.payerEmail.toLowerCase());
}

export function verifyPaystackWebhookSignature(rawBody: Buffer, signature: string | null) {
  if (!signature || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const expected = createHmac("sha512", paystackTestKey()).update(rawBody).digest();
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function createPaystackMonthlyPlan(accountId: string, amountCents: number) {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new Error("Invalid plan amount.");
  const plan = await paystackRequest<{ plan_code: string; amount: number; currency: string; interval: string }>("/plan", {
    name: `GreenChoice ${accountId}`,
    amount: amountCents, interval: "monthly", currency: "ZAR", send_invoices: true,
  });
  if (!plan.plan_code || plan.amount !== amountCents || plan.currency !== "ZAR" || plan.interval !== "monthly") {
    throw new Error("Paystack returned an unexpected plan.");
  }
  return plan.plan_code;
}

export async function createPaystackSubscription(input: { customerCode: string; planCode: string; authorizationCode: string; firstDueAt: string }) {
  const result = await paystackRequest<{ domain: string; subscription_code: string; email_token: string; next_payment_date?: string }>("/subscription", {
    customer: input.customerCode, plan: input.planCode, authorization: input.authorizationCode,
    start_date: input.firstDueAt,
  });
  if (result.domain !== "test" || !result.subscription_code || !result.email_token) throw new Error("Paystack returned an unexpected subscription.");
  return result;
}

export async function updatePaystackPlan(planCode: string, amountCents: number) {
  if (!/^PLN_[a-zA-Z0-9]+$/.test(planCode) || !Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new Error("Invalid plan update.");
  }
  return paystackRequest<Record<string, unknown>>(`/plan/${encodeURIComponent(planCode)}`,
    { amount: amountCents, update_existing_subscriptions: true }, "PUT", true);
}

export async function paystackCardUpdateLink(subscriptionCode: string) {
  if (!/^SUB_[a-zA-Z0-9]+$/.test(subscriptionCode)) throw new Error("Invalid subscription code.");
  const result = await paystackRequest<{ link: string }>(`/subscription/${encodeURIComponent(subscriptionCode)}/manage/link`);
  const url = new URL(result.link);
  if (url.protocol !== "https:" || url.hostname !== "paystack.com") throw new Error("Invalid card update link.");
  return url.toString();
}
