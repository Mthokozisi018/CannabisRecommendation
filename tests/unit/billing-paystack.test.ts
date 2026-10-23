import { createHmac } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createPaystackSubscription, initializePaystackCheckout, paymentMatchesExpected, verifyPaystackTransaction, verifyPaystackWebhookSignature } from "@/lib/billing/paystack";

vi.mock("server-only", () => ({}));
const originalEnv = { secret: process.env.PAYSTACK_SECRET_KEY, mode: process.env.PAYSTACK_MODE, app: process.env.GREENCHOICE_ENV };
beforeEach(() => {
  process.env.PAYSTACK_SECRET_KEY = "sk_test_unit_test_only";
  process.env.PAYSTACK_MODE = "test";
  process.env.GREENCHOICE_ENV = "staging";
});
afterEach(() => {
  if (originalEnv.secret === undefined) delete process.env.PAYSTACK_SECRET_KEY; else process.env.PAYSTACK_SECRET_KEY = originalEnv.secret;
  if (originalEnv.mode === undefined) delete process.env.PAYSTACK_MODE; else process.env.PAYSTACK_MODE = originalEnv.mode;
  if (originalEnv.app === undefined) delete process.env.GREENCHOICE_ENV; else process.env.GREENCHOICE_ENV = originalEnv.app;
  vi.unstubAllGlobals();
});

it("initializes hosted checkout with only the server's test key and fixed ZAR cents", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: true, data: { authorization_url: "https://checkout.paystack.com/test123", access_code: "test123", reference: "gc-1" } }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  const url = await initializePaystackCheckout({ email: "payer@example.invalid", amountCents: 400_000, reference: "gc-1", callbackUrl: "https://staging.example.invalid/api/payments/paystack/callback", billingId: "billing-id" });
  expect(url).toBe("https://checkout.paystack.com/test123");
  const [requestUrl, options] = fetchMock.mock.calls[0];
  expect(requestUrl).toBe("https://api.paystack.co/transaction/initialize");
  expect(options.headers.Authorization).toBe("Bearer sk_test_unit_test_only");
  const checkout = JSON.parse(options.body);
  expect(checkout).toMatchObject({ amount: 400_000, currency: "ZAR", reference: "gc-1", channels: ["card"] });
  expect(checkout).not.toHaveProperty("plan_code");
});

it("schedules the first subscription debit at the following month's date", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: true, data: {
    domain: "test", subscription_code: "SUB_test", email_token: "email_token", next_payment_date: "2026-11-21T10:00:00Z",
  } }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  await createPaystackSubscription({ customerCode: "CUS_test", planCode: "PLN_test", authorizationCode: "AUTH_test", firstDueAt: "2026-11-21T10:00:00Z" });
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe("https://api.paystack.co/subscription");
  expect(JSON.parse(options.body)).toMatchObject({ customer: "CUS_test", plan: "PLN_test", authorization: "AUTH_test", start_date: "2026-11-21T10:00:00Z" });
});

it("rejects live credentials and permits production only in test mode", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  process.env.PAYSTACK_SECRET_KEY = "sk_live_forbidden";
  await expect(verifyPaystackTransaction("gc-1")).rejects.toThrow("test secret key");
  process.env.PAYSTACK_SECRET_KEY = "sk_test_unit_test_only";
  process.env.GREENCHOICE_ENV = "production";
  process.env.PAYSTACK_MODE = "live";
  await expect(verifyPaystackTransaction("gc-1")).rejects.toThrow("test mode");
  expect(fetchMock).not.toHaveBeenCalled();
  process.env.PAYSTACK_MODE = "test";
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: true, data: {
    id: 1, domain: "test", status: "success", reference: "gc-1", amount: 100, currency: "ZAR"
  } }), { status: 200 }));
  await expect(verifyPaystackTransaction("gc-1")).resolves.toMatchObject({ domain: "test" });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("accepts only a fully matching verified test payment", () => {
  const transaction = { id: 1, domain: "test", status: "success", reference: "gc-1", amount: 250_000, currency: "ZAR" };
  expect(paymentMatchesExpected(transaction, { reference: "gc-1", amountCents: 250_000 })).toBe(true);
  expect(paymentMatchesExpected({ ...transaction, amount: 450_000 }, { reference: "gc-1", amountCents: 250_000 })).toBe(false);
  expect(paymentMatchesExpected({ ...transaction, currency: "NGN" }, { reference: "gc-1", amountCents: 250_000 })).toBe(false);
  expect(paymentMatchesExpected({ ...transaction, reference: "gc-2" }, { reference: "gc-1", amountCents: 250_000 })).toBe(false);
  expect(paymentMatchesExpected({ ...transaction, domain: "live" }, { reference: "gc-1", amountCents: 250_000 })).toBe(false);
  expect(paymentMatchesExpected({ ...transaction, status: "failed" }, { reference: "gc-1", amountCents: 250_000 })).toBe(false);
});

it("requires the checkout's organization and payer to match the verified transaction", () => {
  const transaction = { id: 91, domain: "test", status: "success", reference: "gc-onboard-1", amount: 250_000,
    currency: "ZAR", metadata: { greenchoice_billing_id: "organization-a" }, customer: { email: "owner@example.invalid" } };
  const expected = { reference: "gc-onboard-1", amountCents: 250_000, billingId: "organization-a", payerEmail: "owner@example.invalid" };
  expect(paymentMatchesExpected(transaction, expected)).toBe(true);
  expect(paymentMatchesExpected({ ...transaction, metadata: { greenchoice_billing_id: "organization-b" } }, expected)).toBe(false);
  expect(paymentMatchesExpected({ ...transaction, customer: { email: "other@example.invalid" } }, expected)).toBe(false);
  expect(paymentMatchesExpected({ ...transaction, metadata: "invalid-json" }, expected)).toBe(false);
});

it("checks the raw webhook bytes with HMAC SHA512", () => {
  const body = Buffer.from('{"event":"charge.success"}');
  const signature = createHmac("sha512", "sk_test_unit_test_only").update(body).digest("hex");
  expect(verifyPaystackWebhookSignature(body, signature)).toBe(true);
  expect(verifyPaystackWebhookSignature(Buffer.from('{"event":"charge.failed"}'), signature)).toBe(false);
  expect(verifyPaystackWebhookSignature(body, "wrong")).toBe(false);
});
