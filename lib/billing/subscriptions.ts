import "server-only";
import { billingDb } from "./accounts";
import { createPaystackMonthlyPlan, createPaystackSubscription, paystackCardUpdateLink, updatePaystackPlan } from "./paystack";
import { franchiseMonthlyPriceCents } from "./pricing";

type SubscriptionRow = {
  id: string; account_id: string; paystack_customer_code: string | null;
  paystack_plan_code: string | null; paystack_subscription_code: string | null;
  authorization_code: string | null; first_due_at: string | null;
  next_payment_at: string | null;
  monthly_amount_cents: number; billable_store_count: number;
};

export async function provisionSubscription(accountId: string) {
  const client = billingDb();
  const { data: claimed, error: claimError } = await client.rpc("claim_billing_subscription", { p_account_id: accountId });
  if (claimError) throw new Error("Subscription setup could not be claimed.");
  if (!claimed) return;
  const { data: row, error } = await client.from("billing_subscriptions")
    .select("id,account_id,paystack_customer_code,paystack_plan_code,paystack_subscription_code,authorization_code,first_due_at,next_payment_at,monthly_amount_cents,billable_store_count")
    .eq("account_id", accountId).single<SubscriptionRow>();
  if (error || !row?.paystack_customer_code || !row.authorization_code || !row.first_due_at) throw new Error("Subscription authorization is missing.");
  try {
    const planCode = row.paystack_plan_code ?? await createPaystackMonthlyPlan(accountId, row.monthly_amount_cents);
    if (!row.paystack_plan_code) {
      const { error: planWriteError } = await client.from("billing_subscriptions").update({ paystack_plan_code: planCode }).eq("id", row.id);
      if (planWriteError) throw new Error("Subscription plan could not be recorded.");
    }
    const provider = await createPaystackSubscription({ customerCode: row.paystack_customer_code,
      planCode, authorizationCode: row.authorization_code, firstDueAt: row.first_due_at });
    const { error: subscriptionError } = await client.from("billing_subscriptions").update({
      paystack_subscription_code: provider.subscription_code, paystack_email_token: provider.email_token,
      status: "active", next_payment_at: provider.next_payment_date ?? row.first_due_at,
    }).eq("id", row.id).eq("status", "provisioning");
    if (subscriptionError) throw new Error("Subscription could not be recorded.");
  } catch {
    // A provider request may have completed before a network or DB error. Require
    // reconciliation instead of issuing a second subscription and double billing.
    await client.from("billing_subscriptions").update({ status: "attention" }).eq("id", row.id).eq("status", "provisioning");
  }
}

export async function cardUpdateUrl(accountId: string) {
  const { data, error } = await billingDb().from("billing_subscriptions")
    .select("paystack_subscription_code").eq("account_id", accountId).single();
  if (error || !data?.paystack_subscription_code) throw new Error("No active subscription is available.");
  return paystackCardUpdateLink(data.paystack_subscription_code);
}

export async function synchronizeFranchisePlan(accountId: string, franchiseId: string) {
  const client = billingDb();
  const { count, error: countError } = await client.from("stores").select("id", { count: "exact", head: true })
    .eq("franchise_id", franchiseId).eq("is_active", true);
  if (countError || count === null) throw new Error("Franchise stores could not be counted.");
  const newAmount = franchiseMonthlyPriceCents(count);
  const { data: row, error } = await client.from("billing_subscriptions")
    .select("id,account_id,paystack_customer_code,paystack_plan_code,paystack_subscription_code,authorization_code,first_due_at,next_payment_at,monthly_amount_cents,billable_store_count")
    .eq("account_id", accountId).single<SubscriptionRow>();
  if (error || !row?.paystack_plan_code || !row.paystack_subscription_code || newAmount === row.monthly_amount_cents) return;
  await updatePaystackPlan(row.paystack_plan_code, newAmount);
  const { error: ledgerError } = await client.from("billing_price_changes").insert({
    account_id: accountId, old_amount_cents: row.monthly_amount_cents, new_amount_cents: newAmount,
    old_store_count: row.billable_store_count, new_store_count: count,
    effective_at: row.next_payment_at ?? new Date().toISOString(), reason: "operational_store_count_changed", provider_plan_code: row.paystack_plan_code,
  });
  const { error: updateError } = await client.from("billing_subscriptions").update({
    monthly_amount_cents: newAmount, billable_store_count: count,
  }).eq("id", row.id);
  if (ledgerError || updateError) throw new Error("Franchise price change could not be recorded.");
}
