"use server";
import { redirect } from "next/navigation";
import { getDashboardSession } from "@/lib/dashboard-session";
import { requireBillingOwner } from "@/lib/billing/accounts";
import { beginOnboardingCheckout, beginRecoveryCheckout } from "@/lib/billing/transactions";
import { cardUpdateUrl } from "@/lib/billing/subscriptions";
import { assertRateLimit, verifyOrigin } from "@/lib/security";
import { paystackCheckoutCallbackUrl } from "@/lib/billing/checkout-config";

export async function startOnboardingCheckoutAction(formData: FormData) {
  await verifyOrigin();
  const session = await getDashboardSession();
  if (!session) redirect("/login");
  await assertRateLimit(`billing:checkout:${session.authUserId}`, 8, 15 * 60_000);
  const account = await requireBillingOwner(session, true);
  if (!paystackCheckoutCallbackUrl()) redirect("/billing?checkoutError=configuration" as never);
  const expectedAmountCents = Number(formData.get("expectedAmountCents"));
  if (!Number.isSafeInteger(expectedAmountCents) || expectedAmountCents <= 0) redirect("/billing?checkoutError=changed" as never);
  let url: string | null = null;
  let changed = false;
  try { url = await beginOnboardingCheckout(account, session.email, expectedAmountCents); }
  catch (error) {
    changed = error instanceof Error && error.message === "The billing amount changed. Refresh the payment summary.";
    if (!changed) console.error("Could not start Paystack onboarding checkout", error);
  }
  if (changed) redirect("/billing?checkoutError=changed" as never);
  if (!url) redirect("/billing?checkoutError=provider" as never);
  redirect(url as never);
}

export async function startRecoveryCheckoutAction() {
  await verifyOrigin();
  const session = await getDashboardSession();
  if (!session) redirect("/login");
  await assertRateLimit(`billing:recovery:${session.authUserId}`, 8, 15 * 60_000);
  const account = await requireBillingOwner(session);
  if (!paystackCheckoutCallbackUrl()) redirect("/billing?checkoutError=configuration" as never);
  let url: string | null = null;
  try { url = await beginRecoveryCheckout(account, session.email); }
  catch (error) { console.error("Could not start Paystack recovery checkout", error); }
  if (!url) redirect("/billing?checkoutError=provider" as never);
  redirect(url as never);
}

export async function updatePaymentMethodAction() {
  await verifyOrigin();
  const session = await getDashboardSession();
  if (!session) redirect("/login");
  await assertRateLimit(`billing:card:${session.authUserId}`, 8, 15 * 60_000);
  const account = await requireBillingOwner(session);
  const url = await cardUpdateUrl(account.id);
  redirect(url as never);
}
