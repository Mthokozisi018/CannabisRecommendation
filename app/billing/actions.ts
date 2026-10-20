"use server";
import { redirect } from "next/navigation";
import { getDashboardSession } from "@/lib/dashboard-session";
import { requireBillingOwner } from "@/lib/billing/accounts";
import { beginOnboardingCheckout, beginRecoveryCheckout } from "@/lib/billing/transactions";
import { cardUpdateUrl } from "@/lib/billing/subscriptions";
import { assertRateLimit, verifyOrigin } from "@/lib/security";

export async function startOnboardingCheckoutAction() {
  await verifyOrigin();
  const session = await getDashboardSession();
  if (!session) redirect("/login");
  await assertRateLimit(`billing:checkout:${session.authUserId}`, 8, 15 * 60_000);
  const account = await requireBillingOwner(session, true);
  const url = await beginOnboardingCheckout(account, session.email);
  redirect(url as never);
}

export async function startRecoveryCheckoutAction() {
  await verifyOrigin();
  const session = await getDashboardSession();
  if (!session) redirect("/login");
  await assertRateLimit(`billing:recovery:${session.authUserId}`, 8, 15 * 60_000);
  const account = await requireBillingOwner(session);
  const url = await beginRecoveryCheckout(account, session.email);
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
