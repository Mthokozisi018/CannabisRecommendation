import "server-only";
import { billingDb, type BillingAccount } from "./accounts";
import { BILLING_PRICES_CENTS } from "./pricing";
import { initializePaystackCheckout, paymentMatchesExpected, verifyPaystackTransaction } from "./paystack";
import { provisionSubscription } from "./subscriptions";
import { paystackCheckoutCallbackUrl } from "./checkout-config";

type BillingPayment = {
  id: string; account_id: string; reference: string; payer_email: string;
  purpose: "onboarding" | "renewal" | "recovery";
  amount_cents: number; status: "pending" | "success" | "failed";
};

export async function beginOnboardingCheckout(account: BillingAccount, payerEmail: string) {
  const callbackUrl = paystackCheckoutCallbackUrl();
  if (!callbackUrl) throw new Error("The public staging Paystack callback is not configured.");
  if (account.onboarding_paid_at) throw new Error("The onboarding payment has already been completed.");
  const email = payerEmail.trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("A billing owner email is required.");
  const client = billingDb();
  const amountCents = account.franchise_id ? BILLING_PRICES_CENTS.franchiseOnboarding : BILLING_PRICES_CENTS.independentOnboarding;
  const { data: existing, error: lookupError } = await client.from("billing_payments")
    .select("id,account_id,reference,payer_email,purpose,amount_cents,status")
    .eq("account_id", account.id).eq("purpose", "onboarding").eq("status", "pending").maybeSingle<BillingPayment>();
  if (lookupError) throw new Error("Billing payment could not be loaded.");
  let payment = existing;
  if (!payment) {
    const { data, error } = await client.from("billing_payments").insert({
      account_id: account.id, reference: `gc-onboard-${crypto.randomUUID()}`,
      payer_email: email, purpose: "onboarding", amount_cents: amountCents,
    }).select("id,account_id,reference,payer_email,purpose,amount_cents,status").single<BillingPayment>();
    if (error && error.code !== "23505") throw new Error("Billing payment could not be created.");
    if (data) payment = data;
    else {
      const { data: raced, error: racedError } = await client.from("billing_payments")
        .select("id,account_id,reference,payer_email,purpose,amount_cents,status")
        .eq("account_id", account.id).eq("purpose", "onboarding").eq("status", "pending").single<BillingPayment>();
      if (racedError) throw new Error("Billing payment could not be loaded.");
      payment = raced;
    }
  }
  if (payment.payer_email !== email || payment.amount_cents !== amountCents) throw new Error("The pending checkout belongs to another payer or amount.");
  return initializePaystackCheckout({ email, amountCents, reference: payment.reference,
    callbackUrl, billingId: account.id });
}

export async function beginRecoveryCheckout(account: BillingAccount, payerEmail: string) {
  const callbackUrl = paystackCheckoutCallbackUrl();
  if (!callbackUrl) throw new Error("The public staging Paystack callback is not configured.");
  if (!account.onboarding_paid_at || !["grace", "restricted"].includes(account.status)) {
    throw new Error("There is no overdue subscription payment to recover.");
  }
  const client = billingDb();
  const { data: subscription, error: subError } = await client.from("billing_subscriptions")
    .select("monthly_amount_cents,failed_at").eq("account_id", account.id).single();
  if (subError || !subscription?.failed_at) throw new Error("No failed subscription payment was found.");
  const amountCents = subscription.monthly_amount_cents;
  const email = payerEmail.trim().toLowerCase();
  const { data: existing, error: lookupError } = await client.from("billing_payments")
    .select("id,account_id,reference,payer_email,purpose,amount_cents,status")
    .eq("account_id", account.id).eq("purpose", "recovery").eq("status", "pending").maybeSingle<BillingPayment>();
  if (lookupError) throw new Error("Recovery payment could not be loaded.");
  let payment = existing;
  if (!payment) {
    const { data, error } = await client.from("billing_payments").insert({
      account_id: account.id, reference: `gc-recovery-${crypto.randomUUID()}`,
      payer_email: email, purpose: "recovery", amount_cents: amountCents,
    }).select("id,account_id,reference,payer_email,purpose,amount_cents,status").single<BillingPayment>();
    if (error && error.code !== "23505") throw new Error("Recovery payment could not be created.");
    payment = data;
    if (!payment) {
      const { data: raced, error: racedError } = await client.from("billing_payments")
        .select("id,account_id,reference,payer_email,purpose,amount_cents,status")
        .eq("account_id", account.id).eq("purpose", "recovery").eq("status", "pending").single<BillingPayment>();
      if (racedError) throw new Error("Recovery payment could not be loaded.");
      payment = raced;
    }
  }
  if (payment.payer_email !== email || payment.amount_cents !== amountCents) throw new Error("The pending recovery payment does not match this bill.");
  return initializePaystackCheckout({ email, amountCents, reference: payment.reference,
    callbackUrl, billingId: account.id });
}

export async function reconcileBillingPayment(reference: string) {
  if (!/^gc-(onboard|recovery)-[0-9a-f-]{36}$/.test(reference)) return "unknown" as const;
  const client = billingDb();
  const { data: payment, error } = await client.from("billing_payments")
    .select("id,account_id,reference,payer_email,purpose,amount_cents,status").eq("reference", reference).maybeSingle<BillingPayment>();
  if (error || !payment) return "unknown" as const;
  if (payment.status === "success") {
    if (payment.purpose === "onboarding") await provisionSubscription(payment.account_id);
    return "success" as const;
  }
  const verified = await verifyPaystackTransaction(reference);
  if (!paymentMatchesExpected(verified, { reference, amountCents: payment.amount_cents,
    billingId: payment.account_id, payerEmail: payment.payer_email })) return "pending" as const;
  const paidAt = verified.paid_at ? new Date(verified.paid_at) : new Date();
  if (Number.isNaN(paidAt.valueOf()) || !Number.isSafeInteger(verified.id)) return "pending" as const;
  const { error: writeError } = await client.rpc("record_verified_billing_payment", {
    p_reference: reference, p_provider_transaction_id: verified.id,
    p_paid_at: paidAt.toISOString(), p_customer_code: verified.customer?.customer_code ?? null,
    p_authorization_code: verified.authorization?.reusable && verified.authorization.channel === "card"
      ? verified.authorization.authorization_code ?? null : null,
    p_card_last4: verified.authorization?.last4 ?? null,
    p_card_brand: verified.authorization?.brand ?? null,
  });
  if (writeError) throw new Error("Verified payment could not be recorded.");
  if (payment.purpose === "onboarding") await provisionSubscription(payment.account_id);
  return "success" as const;
}
