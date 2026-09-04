import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { stripeStringId, verifyStripeWebhook } from "@/lib/stripe/server";
import type { ManagerSubscriptionRecord, ManagerSubscriptionStatus } from "@/lib/manager/subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const SELECT = "id, store_id, manager_auth_user_id, stripe_customer_id, stripe_subscription_id, stripe_checkout_session_id, stripe_price_id, status, trial_started_at, trial_ends_at, current_period_ends_at, payment_method_ready, grace_period_ends_at, last_payment_failed_at, last_payment_succeeded_at, created_at, updated_at";

type JsonObject = Record<string, unknown>;
type StripeEvent = { id: string; type: string; data: { object: JsonObject } };

function objectValue(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
}

function metadataValue(object: JsonObject, key: string) {
  const metadata = objectValue(object.metadata);
  const value = metadata?.[key];
  return typeof value === "string" && value ? value : null;
}

function unixDate(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Date(value * 1000).toISOString();
}

function normalizedStatus(value: unknown, existing: ManagerSubscriptionRecord | null): ManagerSubscriptionStatus {
  if (value === "trialing") return "trialing";
  if (value === "active") return "active";
  if (value === "past_due") return existing?.grace_period_ends_at ? "grace_period" : "past_due";
  if (value === "unpaid") return "unpaid";
  if (value === "canceled" || value === "incomplete_expired") return "canceled";
  return "incomplete";
}

function invoiceSubscriptionId(invoice: JsonObject) {
  const legacy = stripeStringId(invoice.subscription);
  if (legacy) return legacy;
  const parent = objectValue(invoice.parent);
  const details = objectValue(parent?.subscription_details);
  return stripeStringId(details?.subscription);
}

async function findRecord(admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, object: JsonObject) {
  const storeId = metadataValue(object, "greenchoice_store_id") || (typeof object.client_reference_id === "string" ? object.client_reference_id : null);
  if (storeId) {
    const { data, error } = await admin.from("manager_subscriptions").select(SELECT).eq("store_id", storeId).maybeSingle<ManagerSubscriptionRecord>();
    if (error) throw new Error(error.message);
    if (data) return data;
  }

  const subscriptionId = stripeStringId(object.subscription) || invoiceSubscriptionId(object) || (typeof object.id === "string" && object.object === "subscription" ? object.id : null);
  if (subscriptionId) {
    const { data, error } = await admin.from("manager_subscriptions").select(SELECT).eq("stripe_subscription_id", subscriptionId).maybeSingle<ManagerSubscriptionRecord>();
    if (error) throw new Error(error.message);
    if (data) return data;
  }

  const customerId = stripeStringId(object.customer);
  if (customerId) {
    const { data, error } = await admin.from("manager_subscriptions").select(SELECT).eq("stripe_customer_id", customerId).maybeSingle<ManagerSubscriptionRecord>();
    if (error) throw new Error(error.message);
    if (data) return data;
  }
  return null;
}

async function patchRecord(admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, id: string, values: JsonObject) {
  const { error } = await admin
    .from("manager_subscriptions")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

async function handleCheckoutCompleted(admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, session: JsonObject) {
  const record = await findRecord(admin, session);
  if (!record) return;
  await patchRecord(admin, record.id, {
    stripe_customer_id: stripeStringId(session.customer) ?? record.stripe_customer_id,
    stripe_subscription_id: stripeStringId(session.subscription) ?? record.stripe_subscription_id,
    stripe_checkout_session_id: typeof session.id === "string" ? session.id : record.stripe_checkout_session_id,
    payment_method_ready: true
  });
}

async function handleSubscription(admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, subscription: JsonObject) {
  const record = await findRecord(admin, subscription);
  if (!record) return;
  const status = normalizedStatus(subscription.status, record);
  await patchRecord(admin, record.id, {
    stripe_customer_id: stripeStringId(subscription.customer) ?? record.stripe_customer_id,
    stripe_subscription_id: typeof subscription.id === "string" ? subscription.id : record.stripe_subscription_id,
    status,
    trial_ends_at: unixDate(subscription.trial_end) ?? record.trial_ends_at,
    current_period_ends_at: unixDate(subscription.current_period_end) ?? record.current_period_ends_at,
    payment_method_ready: true,
    grace_period_ends_at: status === "active" || status === "trialing" ? null : record.grace_period_ends_at
  });
}

async function handlePaymentFailed(admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, invoice: JsonObject) {
  const record = await findRecord(admin, invoice);
  if (!record) return;
  const now = new Date();
  await patchRecord(admin, record.id, {
    status: "grace_period",
    grace_period_ends_at: new Date(now.getTime() + 4 * DAY_MS).toISOString(),
    last_payment_failed_at: now.toISOString(),
    payment_method_ready: true
  });
}

async function handlePaymentSucceeded(admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, invoice: JsonObject) {
  const record = await findRecord(admin, invoice);
  if (!record) return;
  await patchRecord(admin, record.id, {
    status: "active",
    grace_period_ends_at: null,
    last_payment_succeeded_at: new Date().toISOString(),
    payment_method_ready: true
  });
}

export async function POST(request: Request) {
  const payload = await request.text();
  try {
    verifyStripeWebhook(payload, request.headers.get("stripe-signature"));
    const event = JSON.parse(payload) as StripeEvent;
    if (!event?.id || !event?.type || !event.data?.object) throw new Error("Malformed Stripe event.");

    const admin = createSupabaseAdminClient();
    if (!admin) throw new Error("Supabase server billing access is not configured.");

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(admin, event.data.object);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscription(admin, event.data.object);
        break;
      case "invoice.payment_failed":
        await handlePaymentFailed(admin, event.data.object);
        break;
      case "invoice.paid":
        await handlePaymentSucceeded(admin, event.data.object);
        break;
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("stripe_webhook_failed", error);
    return NextResponse.json({ error: "Invalid webhook event." }, { status: 400 });
  }
}
