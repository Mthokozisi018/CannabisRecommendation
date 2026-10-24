import { createHmac } from "node:crypto";
import { beforeEach, afterEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { processEvent } = vi.hoisted(() => ({ processEvent: vi.fn() }));
vi.mock("@/lib/billing/events", () => ({ processPaystackEvent: processEvent }));
vi.mock("@/lib/billing/accounts", () => ({ billingEnabled: () => true }));

import { POST } from "@/app/api/payments/paystack/webhook/route";

const previous = { key: process.env.PAYSTACK_SECRET_KEY, mode: process.env.PAYSTACK_MODE,
  environment: process.env.GREENCHOICE_ENV, enabled: process.env.PAYSTACK_BILLING_ENABLED };
beforeEach(() => {
  process.env.PAYSTACK_BILLING_ENABLED = "true";
  process.env.PAYSTACK_SECRET_KEY = "sk_test_webhook_fixture";
  process.env.PAYSTACK_MODE = "test";
  process.env.GREENCHOICE_ENV = "staging";
  processEvent.mockReset();
});
afterEach(() => {
  if (previous.key === undefined) delete process.env.PAYSTACK_SECRET_KEY; else process.env.PAYSTACK_SECRET_KEY = previous.key;
  if (previous.mode === undefined) delete process.env.PAYSTACK_MODE; else process.env.PAYSTACK_MODE = previous.mode;
  if (previous.environment === undefined) delete process.env.GREENCHOICE_ENV; else process.env.GREENCHOICE_ENV = previous.environment;
  if (previous.enabled === undefined) delete process.env.PAYSTACK_BILLING_ENABLED; else process.env.PAYSTACK_BILLING_ENABLED = previous.enabled;
});

it("rejects an invalid webhook signature without processing the event", async () => {
  const response = await POST(new Request("https://staging.example.invalid/api/payments/paystack/webhook", {
    method: "POST", body: '{"event":"charge.success"}', headers: { "x-paystack-signature": "0".repeat(128) },
  }));
  expect(response.status).toBe(401);
  expect(processEvent).not.toHaveBeenCalled();
});

it("passes only signed raw bytes to the processor", async () => {
  const body = '{"event":"invoice.payment_failed","data":{"domain":"test"}}';
  const signature = createHmac("sha512", "sk_test_webhook_fixture").update(body).digest("hex");
  const response = await POST(new Request("https://staging.example.invalid/api/payments/paystack/webhook", {
    method: "POST", body, headers: { "x-paystack-signature": signature },
  }));
  expect(response.status).toBe(200);
  expect(processEvent).toHaveBeenCalledOnce();
  expect(processEvent.mock.calls[0][0]).toEqual(Buffer.from(body));
});

it("verifies a live webhook with the production live key", async () => {
  process.env.GREENCHOICE_ENV = "production";
  process.env.PAYSTACK_MODE = "live";
  process.env.PAYSTACK_SECRET_KEY = "sk_live_webhook_fixture";
  const body = '{"event":"charge.success","data":{"domain":"live"}}';
  const signature = createHmac("sha512", process.env.PAYSTACK_SECRET_KEY).update(body).digest("hex");
  const response = await POST(new Request("https://greenchoice.example.com/api/payments/paystack/webhook", {
    method: "POST", body, headers: { "x-paystack-signature": signature },
  }));
  expect(response.status).toBe(200);
  expect(processEvent).toHaveBeenCalledOnce();
});
