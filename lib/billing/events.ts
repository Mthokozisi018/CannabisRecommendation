import "server-only";
import { createHash } from "node:crypto";
import { billingDb } from "./accounts";
import { reconcileBillingPayment } from "./transactions";
import { verifyPaystackTransaction } from "./paystack";
import { configuredPaystackMode } from "./mode";

type PaystackEvent = {
  event?: string;
  data?: {
    domain?: string;
    reference?: string;
    paid_at?: string;
    created_at?: string;
    subscription_code?: string;
    subscription?: { subscription_code?: string; next_payment_date?: string };
    next_payment_date?: string;
    status?: string;
    paid?: boolean;
    transaction?: { reference?: string; status?: string; amount?: number; currency?: string };
  };
};

export async function processPaystackEvent(raw: Buffer) {
  const parsed = JSON.parse(raw.toString("utf8")) as PaystackEvent;
  const kind = parsed.event ?? "unknown";
  const data = parsed.data;
  const mode = configuredPaystackMode();
  if (!mode || (data?.domain && data.domain !== mode)) throw new Error("Paystack event domain does not match this environment.");
  const eventKey = createHash("sha256").update(raw).digest("hex");
  const client = billingDb();
  const { data: existing, error: readError } = await client.from("billing_provider_events")
    .select("status").eq("event_key", eventKey).maybeSingle();
  if (readError) throw new Error("Could not read Paystack event state.");
  if (existing?.status === "processed" || existing?.status === "ignored") return;
  if (!existing) {
    const { error } = await client.from("billing_provider_events").insert({ event_key: eventKey, event_type: kind,
      provider_reference: data?.reference ?? data?.subscription_code ?? null });
    if (error && error.code !== "23505") throw new Error("Could not record Paystack event.");
  }
  let status: "processed" | "ignored" = "ignored";
  if (kind === "charge.success" && data?.reference) {
    if (data.reference.startsWith("gc-onboard-") || data.reference.startsWith("gc-recovery-")) {
      const outcome = await reconcileBillingPayment(data.reference);
      status = outcome === "success" ? "processed" : "ignored";
    } else {
      const code = data.subscription?.subscription_code ?? data.subscription_code;
      if (code) {
        status = await recordRenewal(code, data.reference) ? "processed" : "ignored";
        if (status === "processed") await recordNextPaymentDate(code, data.subscription?.next_payment_date ?? data.next_payment_date);
      }
    }
  } else if (kind === "invoice.payment_failed") {
    const subscriptionCode = data?.subscription?.subscription_code ?? data?.subscription_code;
    if (subscriptionCode) {
      const failedAt = new Date(data?.created_at ?? Date.now());
      if (!Number.isNaN(failedAt.valueOf())) {
        const { data: recorded, error } = await client.rpc("record_billing_subscription_failure", {
          p_subscription_code: subscriptionCode, p_failed_at: failedAt.toISOString(),
        });
        if (error) throw new Error("Could not record failed payment.");
        status = recorded ? "processed" : "ignored";
      }
    }
  } else if (kind === "invoice.update" && data?.status === "success" && data.paid && data.transaction?.reference) {
    const code = data.subscription?.subscription_code ?? data.subscription_code;
    if (code) {
      status = await recordRenewal(code, data.transaction.reference) ? "processed" : "ignored";
      if (status === "processed") await recordNextPaymentDate(code, data.subscription?.next_payment_date ?? data.next_payment_date);
    }
  } else if (["subscription.create", "invoice.create", "invoice.update", "subscription.not_renew", "subscription.disable"].includes(kind)) {
    // Provider state is reconciled by subscription code; unknown businesses are ignored.
    const code = data?.subscription?.subscription_code ?? data?.subscription_code;
    if (code) {
      const { data: subscription, error } = await client.from("billing_subscriptions")
        .select("id,account_id").eq("paystack_subscription_code", code).maybeSingle();
      if (error) throw new Error("Could not load subscription event.");
      if (subscription) {
        const update: Record<string, string | null> = {};
        if (kind === "subscription.disable" || kind === "subscription.not_renew") update.status = "cancelled";
        if (data?.next_payment_date && !Number.isNaN(new Date(data.next_payment_date).valueOf())) update.next_payment_at = data.next_payment_date;
        if (Object.keys(update).length) {
          const { error: updateError } = await client.from("billing_subscriptions").update(update).eq("id", subscription.id);
          if (updateError) throw new Error("Could not update subscription event.");
        }
        if (kind === "subscription.disable") {
          const { error: accountError } = await client.from("billing_accounts")
            .update({ status: "cancelled", grace_ends_at: null }).eq("id", subscription.account_id);
          if (accountError) throw new Error("Could not close the disabled subscription account.");
        }
        status = "processed";
      }
    }
  }
  const { error: doneError } = await client.from("billing_provider_events")
    .update({ status, processed_at: new Date().toISOString() }).eq("event_key", eventKey);
  if (doneError) throw new Error("Could not complete Paystack event.");
}

async function recordRenewal(subscriptionCode: string, reference: string) {
  if (!/^SUB_[a-zA-Z0-9]+$/.test(subscriptionCode) || !/^[a-zA-Z0-9.=-]+$/.test(reference)) return false;
  const client = billingDb();
  const { data: sub, error } = await client.from("billing_subscriptions")
    .select("paystack_customer_code,monthly_amount_cents")
    .eq("paystack_subscription_code", subscriptionCode).maybeSingle();
  if (error || !sub?.paystack_customer_code) return false;
  const verified = await verifyPaystackTransaction(reference);
  if (verified.domain !== configuredPaystackMode() || verified.status !== "success" || verified.reference !== reference
    || verified.currency !== "ZAR" || verified.amount !== sub.monthly_amount_cents
    || verified.customer?.customer_code !== sub.paystack_customer_code || !Number.isSafeInteger(verified.id)) return false;
  const paidAt = new Date(verified.paid_at ?? Date.now());
  if (Number.isNaN(paidAt.valueOf())) return false;
  const { error: writeError } = await client.rpc("record_verified_billing_renewal", {
    p_subscription_code: subscriptionCode, p_reference: reference,
    p_provider_transaction_id: verified.id, p_amount_cents: verified.amount,
    p_paid_at: paidAt.toISOString(), p_customer_code: verified.customer?.customer_code,
  });
  if (writeError) throw new Error("Renewal could not be recorded.");
  return true;
}

async function recordNextPaymentDate(subscriptionCode: string, value?: string) {
  if (!value || Number.isNaN(new Date(value).valueOf())) return;
  const { error } = await billingDb().from("billing_subscriptions").update({ next_payment_at: value })
    .eq("paystack_subscription_code", subscriptionCode).lt("next_payment_at", value);
  if (error) throw new Error("Next payment date could not be updated.");
}
