import Link from "next/link";
import { CalendarDays, Check, CircleHelp, CreditCard, Crown, ExternalLink, Leaf, ShieldCheck } from "lucide-react";
import { DashboardBackdrop } from "@/components/GreenChoiceDashboard";
import { ManagerAccountMenu } from "@/components/manager/ManagerAccountMenu";
import { getManagerSubscriptionOverview, requireManagerSubscriptionSession, subscriptionStatusLabel } from "@/lib/manager/subscription";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

function dateLabel(value: string | null | undefined) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function remainingDays(value: string | null | undefined) {
  if (!value) return 0;
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / DAY_MS));
}

function statusTone(status: string | null) {
  if (status === "active") return "border-[#35dc68] bg-[#10361d] text-[#73f191]";
  if (status === "grace_period" || status === "past_due") return "border-[#e3ad38] bg-[#35280c] text-[#ffd66d]";
  if (status === "restricted" || status === "unpaid" || status === "canceled") return "border-[#d15a5a] bg-[#351313] text-[#ff9999]";
  return "border-[#35dc68] bg-[#10361d] text-[#73f191]";
}

export default async function ManagerSubscriptionPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireManagerSubscriptionSession();
  const params = await searchParams;
  const state = await getManagerSubscriptionOverview(session);
  const subscription = state.record;
  const status = subscription?.status ?? null;
  const isGrace = status === "grace_period" || status === "past_due";
  const restricted = status === "restricted" || status === "unpaid" || status === "canceled";
  const countdownDate = isGrace ? subscription?.grace_period_ends_at : subscription?.trial_ends_at;
  const days = remainingDays(countdownDate);
  const paymentReady = Boolean(subscription?.payment_method_ready && subscription?.stripe_customer_id);
  const canOpenCheckout = state.storageReady && Boolean(subscription);
  const checkoutSuccess = params.checkout === "success";
  const checkoutCancelled = params.checkout === "cancelled";
  const billingError = params.billing_error;

  return (
    <>
      <DashboardBackdrop variant="manager" />
      <ManagerAccountMenu managerName={session.displayName} storeName={session.storeName} />

      <main className="relative isolate min-h-screen px-4 pb-10 pt-7 text-white sm:px-7 sm:pt-8 lg:px-10">
        <div className="mx-auto w-full max-w-[1450px]">
          <header className="pr-0 sm:pr-[310px]">
            <Link href="/dashboard/manager" className="inline-flex items-center" aria-label="Back to manager dashboard">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/branding/greenchoice-logo.png" alt="GreenChoice" className="h-16 w-auto object-contain sm:h-20" />
            </Link>
            <h1 className="mt-7 text-4xl font-black tracking-tight text-white sm:text-5xl">Manage Subscription</h1>
            <p className="mt-3 max-w-3xl text-base font-medium leading-7 text-white/72 sm:text-lg">
              Your GreenChoice manager subscription keeps your store connected to POS, inventory, products and authorised store users.
            </p>
          </header>

          {checkoutSuccess ? (
            <div className="mt-5 rounded-2xl border border-[#35dc68] bg-[#0f321c] px-5 py-4 text-sm font-bold text-[#8ff4a7]">
              Payment method setup completed. Stripe will confirm the subscription status securely through the webhook.
            </div>
          ) : null}
          {checkoutCancelled ? (
            <div className="mt-5 rounded-2xl border border-[#8a7335] bg-[#2a230f] px-5 py-4 text-sm font-bold text-[#f5d777]">
              Stripe Checkout was closed. You can add your payment method whenever you are ready.
            </div>
          ) : null}
          {billingError ? (
            <div className="mt-5 rounded-2xl border border-[#a74646] bg-[#2a1010] px-5 py-4 text-sm font-bold text-[#ffadad]">
              The secure Stripe billing page could not be opened. No charge was made. Please try again.
            </div>
          ) : null}

          <section className="mt-8 grid gap-5 rounded-[22px] border border-[#205c34] bg-[#07170e] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.42)] md:grid-cols-[1fr_auto] md:items-center lg:p-8">
            <div className="flex items-start gap-5">
              <span className="grid size-20 shrink-0 place-items-center rounded-full border-2 border-[#1d7137] bg-[#0d2e1a] text-[#f2cf4b]">
                <Crown aria-hidden="true" size={39} />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-black sm:text-3xl">
                    {restricted ? "Subscription Requires Payment" : isGrace ? "4-Day Payment Grace Period" : status === "active" ? "Subscription Active" : "30-Day Free Trial"}
                  </h2>
                  <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${statusTone(status)}`}>
                    {subscriptionStatusLabel(status)}
                  </span>
                </div>
                <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-white/70 sm:text-base">
                  {restricted
                    ? "Your billing grace period has ended. Update your payment through Stripe to restore GreenChoice access. Your store data remains preserved."
                    : isGrace
                      ? "Stripe could not complete your monthly payment. Your store remains available during this four-day grace period."
                      : status === "active"
                        ? "Your monthly manager subscription is active and your store remains fully enabled."
                        : "Add your payment method during the free trial. You will not be charged before the trial ends."}
                </p>
              </div>
            </div>

            <div className="min-w-[220px] border-t border-[#205c34] pt-5 md:border-l md:border-t-0 md:pl-8 md:pt-0">
              <p className="text-sm font-bold text-white/65">{isGrace || restricted ? "Grace period" : status === "active" ? "Next billing" : "Trial ends in"}</p>
              {status === "active" ? (
                <>
                  <p className="mt-2 text-2xl font-black text-[#5eeb79]">R1,100</p>
                  <p className="mt-1 text-sm font-semibold text-white/70">{dateLabel(subscription?.current_period_ends_at)}</p>
                </>
              ) : (
                <>
                  <p className={`mt-2 text-3xl font-black ${restricted ? "text-[#ff8787]" : isGrace ? "text-[#ffd15c]" : "text-[#5eeb79]"}`}>{days} days</p>
                  <p className="mt-1 text-sm font-semibold text-white/70">{dateLabel(countdownDate)}</p>
                </>
              )}
            </div>
          </section>

          <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.95fr_0.9fr]">
            <section className="rounded-[20px] border border-[#253b2d] bg-[#0a120e] p-6 shadow-[0_18px_46px_rgba(0,0,0,0.34)]">
              <p className="text-lg font-black">Your Plan</p>
              <h2 className="mt-4 text-2xl font-black text-[#55e875]">GreenChoice Manager Subscription</h2>
              <p className="mt-3 text-4xl font-black">R1,100 <span className="text-base font-bold text-white/58">/ month</span></p>
              <div className="mt-6 space-y-3 text-sm font-semibold text-white/82">
                {["Full store management access", "Manage products and inventory", "Process sales and serve customers", "Sales overview and reporting", "Authorised receptionist access", "Ongoing GreenChoice updates"].map((benefit) => (
                  <p key={benefit} className="flex items-center gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#39df69] text-[#06110a]"><Check size={15} strokeWidth={3} /></span>{benefit}</p>
                ))}
              </div>
            </section>

            <section className="rounded-[20px] border border-[#253b2d] bg-[#0b1410] p-6 shadow-[0_18px_46px_rgba(0,0,0,0.34)]">
              <p className="text-lg font-black">Payment Method</p>
              <div className="mt-7 flex items-start gap-4">
                <span className="grid size-14 shrink-0 place-items-center rounded-full bg-[#18211d] text-white/60"><CreditCard size={30} /></span>
                <div>
                  <p className="font-black">{paymentReady ? "Payment method ready" : "No payment method added yet"}</p>
                  <p className="mt-2 text-sm font-medium leading-6 text-white/62">
                    {paymentReady ? "Your payment details are stored securely by Stripe, not GreenChoice." : "Add a payment method so your subscription can continue after the free trial."}
                  </p>
                </div>
              </div>

              {paymentReady ? (
                <form action="/api/stripe/manager-portal" method="post" className="mt-8">
                  <button type="submit" className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#45e86b] px-5 font-black text-[#031007] shadow-[0_14px_35px_rgba(69,232,107,0.22)] transition hover:bg-[#6cf28a]">
                    Manage Payment Method <ExternalLink size={18} />
                  </button>
                </form>
              ) : (
                <form action="/api/stripe/manager-checkout" method="post" className="mt-8">
                  <button type="submit" disabled={!canOpenCheckout} className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#45e86b] px-5 font-black text-[#031007] shadow-[0_14px_35px_rgba(69,232,107,0.22)] transition hover:bg-[#6cf28a] disabled:cursor-not-allowed disabled:bg-[#38513f] disabled:text-white/50">
                    Add Payment Method <ExternalLink size={18} />
                  </button>
                </form>
              )}
              <p className="mt-4 flex items-center justify-center gap-2 text-xs font-bold text-white/48"><ShieldCheck size={15} /> Securely handled by Stripe</p>
              {!state.storageReady ? <p className="mt-3 text-center text-xs font-semibold text-[#ffd36c]">Billing database migration is not active in this environment yet.</p> : null}
            </section>

            <section className="rounded-[20px] border border-[#253b2d] bg-[#0a120e] p-6 shadow-[0_18px_46px_rgba(0,0,0,0.34)]">
              <p className="flex items-center gap-2 text-lg font-black"><CircleHelp size={20} className="text-[#55e875]" /> How it works</p>
              <ol className="mt-6 space-y-6">
                <li className="flex gap-4"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#123d22] font-black text-[#68ee83]">1</span><div><p className="font-black">30-day free trial</p><p className="mt-1 text-sm leading-6 text-white/60">Add your payment method securely. No subscription charge is made before the trial ends.</p></div></li>
                <li className="flex gap-4"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#123d22] font-black text-[#68ee83]">2</span><div><p className="font-black">R1,100/month</p><p className="mt-1 text-sm leading-6 text-white/60">Stripe automatically attempts the monthly payment when the trial ends and on each renewal.</p></div></li>
                <li className="flex gap-4"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#123d22] font-black text-[#68ee83]">3</span><div><p className="font-black">4-day grace period</p><p className="mt-1 text-sm leading-6 text-white/60">If payment fails, store access continues for four days while the manager fixes payment.</p></div></li>
              </ol>
            </section>
          </div>

          <section className="mt-6 flex flex-col gap-5 rounded-[20px] border border-[#253b2d] bg-[#0a120e] p-6 shadow-[0_18px_46px_rgba(0,0,0,0.34)] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-full bg-[#123d22] text-[#65eb7e]"><Leaf size={29} /></span>
              <div><p className="font-black">You&apos;re in control</p><p className="mt-1 text-sm font-medium leading-6 text-white/60">Update your payment method through Stripe. GreenChoice only stores billing references and subscription status.</p></div>
            </div>
            <Link href="/dashboard/manager" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#365441] bg-[#101a14] px-5 text-sm font-black text-white transition hover:border-[#5deb79] hover:text-[#72ee89]">
              <CalendarDays size={17} /> Back to Dashboard
            </Link>
          </section>
        </div>
      </main>
    </>
  );
}
