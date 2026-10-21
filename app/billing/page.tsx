import Link from "next/link";
import { redirect } from "next/navigation";
import { CreditCard, ShieldCheck } from "lucide-react";
import { getDashboardSession } from "@/lib/dashboard-session";
import { billingAccountForSession, billingDb, billingEnabled, currentMonthlyPrice } from "@/lib/billing/accounts";
import { amountInRand, BILLING_PRICES_CENTS } from "@/lib/billing/pricing";
import { paystackCheckoutCallbackUrl } from "@/lib/billing/checkout-config";
import { startOnboardingCheckoutAction, startRecoveryCheckoutAction, updatePaymentMethodAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkoutError?: string }> }) {
  if (!billingEnabled()) redirect("/dashboard" as never);
  const session = await getDashboardSession();
  if (!session) redirect("/login");
  const account = await billingAccountForSession(session, true);
  if (!account) redirect("/denied" as never);
  const owner = account.owner_profile_id === session.staffProfileId;
  if (!owner) redirect("/billing/restricted" as never);
  const checkoutReady = Boolean(paystackCheckoutCallbackUrl());
  const { checkoutError } = await searchParams;
  const { amountCents, count } = await currentMonthlyPrice(account);
  const onboardingAmount = account.franchise_id ? BILLING_PRICES_CENTS.franchiseOnboarding : BILLING_PRICES_CENTS.independentOnboarding;
  const client = billingDb();
  const [{ data: subscription }, { data: payments }] = await Promise.all([
    client.from("billing_subscriptions").select("status,next_payment_at,card_last4,card_brand,monthly_amount_cents").eq("account_id", account.id).maybeSingle(),
    client.from("billing_payments").select("id,purpose,amount_cents,status,paid_at,created_at").eq("account_id", account.id).order("created_at", { ascending: false }).limit(12),
  ]);
  return (
    <main className="min-h-screen bg-[#061b13] px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href={account.franchise_id ? "/dashboard/franchise" : "/dashboard/manager"} className="text-sm text-emerald-300 hover:underline">← Dashboard</Link>
        <section className="mt-5 rounded-2xl border border-emerald-400/40 bg-[#0b2b20] p-5 shadow-2xl sm:p-8">
          <div className="flex items-center gap-3 text-emerald-300"><CreditCard aria-hidden="true" /><span className="text-sm font-semibold uppercase tracking-wider">GreenChoice billing</span></div>
          <h1 className="mt-3 text-3xl font-bold">Payments & subscription</h1>
          <p className="mt-2 text-white/70">{account.franchise_id ? "Franchise" : "Independent store"} · Billing owner</p>
          {checkoutError === "provider" && checkoutReady ? <p role="alert" className="mt-4 rounded-lg border border-amber-300/40 bg-amber-400/10 p-3 text-sm text-amber-100">Paystack checkout could not start. Please try again shortly.</p> : null}
          {!checkoutReady ? <p role="alert" className="mt-4 rounded-lg border border-amber-300/40 bg-amber-400/10 p-3 text-sm text-amber-100">Paystack test checkout is unavailable here. Billing needs a public HTTPS staging site with its callback configured. Please contact the administrator before attempting payment.</p> : null}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-emerald-300/25 bg-black/20 p-4"><p className="text-sm text-white/65">Billing status</p><strong className="mt-1 block text-xl capitalize">{account.status.replace("_", " ")}</strong></div>
            <div className="rounded-xl border border-emerald-300/25 bg-black/20 p-4"><p className="text-sm text-white/65">Monthly amount</p><strong className="mt-1 block text-xl">{amountInRand(subscription?.monthly_amount_cents ?? amountCents)}</strong></div>
          </div>
          {account.franchise_id ? <p className="mt-4 text-sm text-white/75">R2,300 base includes the first store. {Math.max(count - 1, 0)} additional active store(s) × R1,000. Changes take effect at the next renewal.</p> : null}
          {account.status === "onboarding_due" ? (
            <div className="mt-6 rounded-xl border border-amber-300/40 bg-amber-400/10 p-4">
              <p className="font-semibold">One-time onboarding · {amountInRand(onboardingAmount)}</p>
              <p className="mt-1 text-sm text-white/75">Your first monthly payment is due one month after onboarding succeeds.</p>
              {checkoutReady ? <form action={startOnboardingCheckoutAction} className="mt-4"><button type="submit" className="rounded-lg bg-emerald-400 px-5 py-3 font-bold text-[#052016] hover:bg-emerald-300">Pay securely with Paystack</button></form> : null}
            </div>
          ) : null}
          {account.grace_ends_at ? <p className="mt-5 rounded-lg border border-amber-300/40 p-3 text-amber-100">Payment needs attention by {new Date(account.grace_ends_at).toLocaleDateString("en-ZA")}.</p> : null}
          {(account.status === "grace" || account.status === "restricted") && checkoutReady ? <form action={startRecoveryCheckoutAction} className="mt-4"><button className="rounded-lg bg-amber-300 px-5 py-3 font-bold text-[#052016]">Pay overdue amount</button></form> : null}
          {subscription?.card_last4 ? <form action={updatePaymentMethodAction} className="mt-4"><button className="rounded-lg border border-emerald-300/50 px-4 py-2 font-semibold text-emerald-200">Update payment card</button></form> : null}
          <div className="mt-6 flex items-center gap-2 text-sm text-white/75"><ShieldCheck size={18} className="text-emerald-300" /> Card details are entered only on Paystack.</div>
          <dl className="mt-6 grid gap-2 text-sm"><div><dt className="inline text-white/60">Subscription: </dt><dd className="inline capitalize">{subscription?.status ?? "Awaiting onboarding"}</dd></div><div><dt className="inline text-white/60">Next payment: </dt><dd className="inline">{subscription?.next_payment_at ? new Date(subscription.next_payment_at).toLocaleDateString("en-ZA") : "To be scheduled"}</dd></div><div><dt className="inline text-white/60">Payment method: </dt><dd className="inline">{subscription?.card_last4 ? `${subscription.card_brand ?? "Card"} ending ${subscription.card_last4}` : "No card on file"}</dd></div></dl>
          <h2 className="mt-8 text-xl font-bold">Payment history</h2>
          <ul className="mt-3 divide-y divide-emerald-300/20">{payments?.length ? payments.map((payment) => <li key={payment.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span className="capitalize">{payment.purpose} · {payment.status}</span><span>{amountInRand(payment.amount_cents)} · {new Date(payment.paid_at ?? payment.created_at).toLocaleDateString("en-ZA")}</span></li>) : <li className="py-3 text-sm text-white/60">No payments yet.</li>}</ul>
        </section>
      </div>
    </main>
  );
}
