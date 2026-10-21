"use server";
import { redirect } from "next/navigation";
import { getDashboardSession } from "@/lib/dashboard-session";
import { requireBillingOwner } from "@/lib/billing/accounts";
import { beginOnboardingCheckout, beginRecoveryCheckout } from "@/lib/billing/transactions";
import { cardUpdateUrl } from "@/lib/billing/subscriptions";
import { assertRateLimit, verifyOrigin } from "@/lib/security";
import { paystackCheckoutCallbackUrl } from "@/lib/billing/checkout-config";

export async function startOnboardingCheckoutAction() {
  await verifyOrigin();
  const session = await getDashboardSession();
  if (!session) redirect("/login");
  await assertRateLimit(`billing:checkout:${session.authUserId}`, 8, 15 * 60_000);
  const account = await requireBillingOwner(session, true);
  if (!paystackCheckoutCallbackUrl()) redirect("/billing?checkoutError=configuration" as never);
  let url: string | null = null;
  try { url = await beginOnboardingCheckout(account, session.email); }
  catch { console.error("Could not start Paystack onboarding checkout"); }
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
  catch { console.error("Could not start Paystack recovery checkout"); }
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
