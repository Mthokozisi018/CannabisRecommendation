import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BarChart3, Building2, Check, ChevronDown, CreditCard, FileText, GraduationCap, Headphones, Info, MapPin, Package, Plus, ShieldCheck, Sprout, Store, UserRound, Users } from "lucide-react";
import { DashboardBackdrop } from "@/components/DashboardBackdrop";
import { getDashboardSession } from "@/lib/dashboard-session";
import { billingAccountForSession, billingDb, billingEnabled, currentMonthlyPrice } from "@/lib/billing/accounts";
import { BILLING_PRICES_CENTS, initialBillingPriceCents } from "@/lib/billing/pricing";
import { paystackCheckoutCallbackUrl } from "@/lib/billing/checkout-config";
import { startOnboardingCheckoutAction, startRecoveryCheckoutAction, updatePaymentMethodAction } from "./actions";
import styles from "./billing.module.css";

export const dynamic = "force-dynamic";
type Feature = { title: string; icon: typeof Store; items: string[] };
const faOnboarding: Feature[] = [
  { title: "Franchise Dashboard Access", icon: BarChart3, items: ["Franchise-wide overview", "Store management", "Staff management", "Sales and inventory tracking", "Reports and analytics", "Account and billing management"] },
  { title: "First Store Setup", icon: Store, items: ["Store configuration", "Product category setup", "Payment settings", "Customer registration setup", "User account setup", "Initial store preparation"] },
  { title: "System Onboarding & Training", icon: GraduationCap, items: ["Guided onboarding", "Training resources", "User guides", "Setup assistance", "Documentation", "Help resources"] },
  { title: "Franchise Resources", icon: Users, items: ["Franchise administration features", "Available templates and resources", "Product guidance", "Feature releases", "Support resources", "Franchise tools"] },
];
const managerOnboarding: Feature[] = [
  { title: "Store Setup", icon: Store, items: ["Store configuration", "Product category setup", "Payment method settings", "Store information and branding", "Initial store preparation"] },
  { title: "Manager Account Access", icon: BarChart3, items: ["Manager dashboard", "Store management", "Staff management", "Sales and inventory tracking", "Reporting and analytics"] },
  { title: "Onboarding & Training", icon: GraduationCap, items: ["Guided onboarding", "Training resources", "Documentation", "Setup assistance", "Help resources"] },
  { title: "System Activation", icon: Users, items: ["Account activation", "Existing payment integration settings", "Initial technical assistance", "Available system features", "Billing configuration"] },
];
const faMonthly: Feature[] = [
  { title: "Franchise Account & Store Management", icon: Store, items: ["Multi-store franchise dashboard", "Store registration and management", "Manager account assignment", "Staff management", "Role-based access control", "Store settings"] },
  { title: "Sales & Inventory Management", icon: Package, items: ["Point-of-sale system", "Inventory management", "Supplier management", "Stock monitoring", "Sales overview", "Low-stock alerts"] },
  { title: "Analytics & Reporting", icon: BarChart3, items: ["Daily, weekly and monthly sales", "Store performance analytics", "Product and category performance", "PDF exports"] },
  { title: "Customer Management", icon: UserRound, items: ["Customer registration", "QR-code registration", "Customer profiles and search", "Order and transaction history", "Consent management"] },
  { title: "System Hosting & Security", icon: ShieldCheck, items: ["Cloud hosting", "System security", "System updates", "Monitoring", "Available backup and recovery"] },
  { title: "Support & Maintenance", icon: Headphones, items: ["Technical support", "System maintenance", "Bug fixes", "Feature updates", "Documentation"] },
];
const managerMonthly: Feature[] = [
  { title: "Store Management", icon: Store, items: ["Store information", "Product and inventory management", "Staff management", "Supplier management"] },
  { title: "Sales & Analytics", icon: BarChart3, items: ["Sales overview and revenue tracking", "Product performance", "Daily, weekly and monthly reports", "PDF exports"] },
  { title: "Customer Management", icon: UserRound, items: ["Customer registration", "Customer profiles and history", "Customer search", "Consent management"] },
  { title: "System Hosting & Security", icon: ShieldCheck, items: ["Cloud hosting", "System security", "Updates and monitoring", "Available backup protections"] },
  { title: "Support & Maintenance", icon: Headphones, items: ["Technical assistance", "System maintenance", "Bug fixes", "Feature improvements", "Documentation"] },
  { title: "Payment Integration", icon: CreditCard, items: ["POS payment recording", "Cash, card and split payments", "Transaction history", "Supported provider integrations"] },
];
function Features({ features, monthly = false }: { features: Feature[]; monthly?: boolean }) {
  return <div className={monthly ? styles.monthlyFeatures : styles.onboardingFeatures}>{features.map(({ title, icon: Icon, items }) => <div className={styles.feature} key={title}><Icon className={monthly ? styles.blueIcon : styles.greenIcon} size={27} aria-hidden="true" /><div><h3>{title}</h3><ul>{items.map(item => <li key={item}><Check size={13} strokeWidth={3} aria-hidden="true" />{item}</li>)}</ul></div></div>)}</div>;
}
function dateLabel(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Johannesburg" }) : "Not available";
}
function amountInRand(cents: number) {
  return `R ${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)}`;
}
export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkoutError?: string }> }) {
  if (!billingEnabled()) redirect("/dashboard" as never);
  const session = await getDashboardSession();
  if (!session) redirect("/login");
  const account = await billingAccountForSession(session, true);
  if (!account) redirect("/denied" as never);
  const isBillingOwner = account.owner_profile_id === session.staffProfileId;
  const fa = Boolean(account.franchise_id);
  const dashboard = fa ? "/dashboard/franchise" : "/dashboard/manager";
  const checkoutReady = Boolean(paystackCheckoutCallbackUrl());
  const { checkoutError } = await searchParams;
  const client = billingDb();
  const [{ amountCents, count }, { data: subscription }, { data: payments }, { data: organization }, { data: pendingOnboarding }] = await Promise.all([
    currentMonthlyPrice(account),
    client.from("billing_subscriptions").select("status,next_payment_at,card_last4,card_brand,monthly_amount_cents,failed_at,billable_store_count").eq("account_id", account.id).maybeSingle(),
    client.from("billing_payments").select("id,purpose,amount_cents,status,paid_at,created_at").eq("account_id", account.id).order("created_at", { ascending: false }).limit(12),
    fa ? client.from("franchises").select("name,created_at").eq("id", account.franchise_id!).single() : client.from("stores").select("name,city,province,address,created_at").eq("id", account.store_id!).single(),
    client.from("billing_payments").select("amount_cents,initial_monthly_amount_cents,initial_billable_store_count").eq("account_id", account.id).eq("purpose", "onboarding").eq("status", "pending").maybeSingle(),
  ]);
  const org = organization as { name?: string; created_at?: string; city?: string | null; province?: string | null; address?: string | null } | null;
  const name = org?.name || session.storeName || "Your account";
  const onboarding = !account.onboarding_paid_at;
  const overdue = account.status === "grace" || account.status === "restricted";
  const onboardingAmount = fa ? BILLING_PRICES_CENTS.franchiseOnboarding : BILLING_PRICES_CENTS.independentOnboarding;
  const initialPrice = initialBillingPriceCents(fa, amountCents);
  const legacyPending = onboarding && pendingOnboarding && pendingOnboarding.initial_monthly_amount_cents === null;
  const monthlyAmount = subscription?.monthly_amount_cents ?? (onboarding ? pendingOnboarding?.initial_monthly_amount_cents ?? amountCents : amountCents);
  const extraCount = fa ? Math.max((onboarding ? pendingOnboarding?.initial_billable_store_count ?? count : subscription?.billable_store_count ?? count) - 1, 0) : 0;
  const extraAmount = extraCount * BILLING_PRICES_CENTS.franchiseAdditionalStoreMonthly;
  const baseAmount = fa ? monthlyAmount - extraAmount : monthlyAmount;
  const dueNow = onboarding ? pendingOnboarding?.amount_cents ?? initialPrice.totalCents : overdue ? monthlyAmount : 0;
  const daysLeft = account.grace_ends_at ? Math.max(0, Math.ceil((new Date(account.grace_ends_at).getTime() - new Date().getTime()) / 86_400_000)) : 0;
  return <main className={styles.page}>
    <DashboardBackdrop variant="receptionist" />
    <header className={styles.header}><Link href={dashboard as never} className={styles.brand}><Sprout size={42} aria-hidden="true" /><span><strong>Green<span>Choice</span></strong><small>Retail Management System</small></span></Link><div className={styles.headerRight}><Link href={dashboard as never} className={styles.headerAccount}>{fa ? <Building2 size={23} /> : <Store size={23} />}<span><strong>{name}</strong><small>{fa ? "Franchise Account" : "Single Store Account"}</small></span><ChevronDown size={16} /></Link><div className={styles.headerPerson}><span className={styles.avatar}>{fa ? "FA" : session.displayName.slice(0, 1).toUpperCase()}</span><span><strong>{session.displayName}</strong><small>{fa ? "Franchise Administrator" : "Store Manager"}</small></span></div></div></header>
    <div className={styles.content}><div className={styles.intro}><div><p className={styles.eyebrow}>▣ &nbsp; BILLING &amp; SUBSCRIPTION</p><h1>Payments &amp; Subscription</h1><p className={styles.subtitle}>Manage your {fa ? "franchise account billing, onboarding and monthly hosting" : "store account billing, onboarding and monthly subscription"}.</p></div><aside className={styles.accountCard}><div className={styles.accountMain}>{fa ? <Building2 size={42} /> : <Store size={42} />}<div><strong>{name}</strong><span className={styles.accountBadge}>{fa ? "Franchise Account" : "Single Store Account"}</span><p>{fa ? "Billing owner: Franchise Administrator" : `Store manager: ${session.displayName}`}</p><p>Member since: {dateLabel(org?.created_at)}</p></div></div><div className={styles.accountSide}>{fa ? <Store size={34} /> : <MapPin size={34} />}<div><strong>{fa ? "Total Stores in Franchise" : "Store Location"}</strong><span>{fa ? count : [org?.city, org?.province].filter(Boolean).join(", ") || org?.address || "Location not available"}</span>{fa ? <small>First store included</small> : <small>Total stores: 1</small>}</div></div></aside></div>
    {checkoutError || !checkoutReady ? <p role="alert" className={styles.alert}>{checkoutError === "changed" ? "The payment amount changed. Review the updated summary and try again." : checkoutError === "provider" && checkoutReady ? "Paystack checkout could not start. Please try again shortly." : "Paystack checkout is unavailable. Please contact support before retrying your payment."}</p> : null}
    {!isBillingOwner ? <p className={styles.alert}>The designated billing owner manages payments for this account.</p> : null}
    <div className={styles.columns}><div className={styles.leftColumn}><section className={`${styles.planCard} ${styles.onboardingCard}`}><div className={styles.planHeading}><span className={`${styles.planIcon} ${styles.greenPlanIcon}`}><FileText size={38} /></span><div className={styles.planTitle}><div className={styles.titleLine}><h2>One-Time Onboarding Payment</h2><span className={onboarding ? styles.requiredBadge : styles.completeBadge}>{onboarding ? "Required" : "Completed"}</span></div><p>{fa ? "A once-off fee to activate your franchise account. This payment includes everything needed to get your franchise up and running." : "A once-off fee to activate your store account. This payment covers everything needed to get your store up and running."}</p></div><div className={styles.amountBlock}><span>Amount {onboarding ? "due" : "paid"}</span><strong>{amountInRand(onboardingAmount)}</strong><small>One-time payment</small></div></div><Features features={fa ? faOnboarding : managerOnboarding} /></section>
    <section className={`${styles.planCard} ${styles.monthlyCard}`}><div className={styles.planHeading}><span className={`${styles.planIcon} ${styles.bluePlanIcon}`}><CreditCard size={38} /></span><div className={styles.planTitle}><div className={styles.titleLine}><h2>Monthly Hosting &amp; Subscription</h2><span className={styles.recurringBadge}>Recurring</span></div><p>{fa ? "Covers system hosting, ongoing support, updates and all stores under your franchise." : "Covers system hosting, ongoing support, updates and all features for your store."}</p></div><div className={styles.amountBlock}><span>Monthly amount</span><strong>{amountInRand(monthlyAmount)}</strong><small>Billed monthly</small></div></div><Features features={fa ? faMonthly : managerMonthly} monthly />{fa ? <div className={styles.additionalStrip}><Plus size={25} /><div><strong>Additional Stores</strong><p>Each additional store registered under your franchise adds R1,000 per month to your hosting subscription.</p></div><span><strong>{amountInRand(BILLING_PRICES_CENTS.franchiseAdditionalStoreMonthly)}</strong><small>per additional store / month</small></span></div> : null}</section></div>
    <aside className={styles.summary}><div className={styles.summaryHeading}><FileText size={33} /><div><h2>Payment Summary</h2><p>Review your payment details before proceeding.</p></div></div><div className={styles.receipt}><div className={styles.receiptBrand}><div><Sprout size={33} /><span><strong>Green<span>Choice</span></strong><small>Retail Management System</small></span></div><p>{fa ? "Franchise Account" : "Store Account"}<br />Payment Summary</p></div><div className={styles.receiptDetails}><div><span>Account</span><strong>{name}</strong></div><div><span>Billing owner</span><strong>{fa ? "Franchise Administrator" : session.displayName}</strong></div><div><span>Billing date</span><strong>{dateLabel(new Date().toISOString())}</strong></div></div><div className={styles.receiptTable}><div className={styles.receiptTableHeader}><strong>Item</strong><strong>Amount</strong></div><div><span><strong>One-Time Onboarding Payment</strong><small>{onboarding ? "Account setup and activation (once-off)" : "Completed"}</small></span><strong>{amountInRand(onboarding ? onboardingAmount : 0)}</strong></div><div><span><strong>{onboarding && !legacyPending ? "First Month Hosting & Subscription" : "Monthly Hosting & Subscription"}</strong><small>{onboarding ? legacyPending ? "First charge one month after onboarding" : "Included today; next renewal in one month" : subscription?.next_payment_at ? `Next payment ${dateLabel(subscription.next_payment_at)}` : "Billed monthly"}</small></span><strong>{amountInRand(onboarding && legacyPending ? 0 : baseAmount)}</strong></div>{fa ? <div><span><strong>Additional Stores</strong><small>{extraCount} × {amountInRand(BILLING_PRICES_CENTS.franchiseAdditionalStoreMonthly)} monthly</small></span><strong>{amountInRand(onboarding && legacyPending ? 0 : extraAmount)}</strong></div> : null}</div><div className={styles.total}><strong>Total due now</strong><strong>{amountInRand(dueNow)}</strong></div><p className={styles.receiptNote}><Info size={20} />{onboarding ? legacyPending ? "This existing checkout charges onboarding only. Monthly hosting starts one month after successful onboarding." : "This payment includes onboarding and the first month of hosting. The next renewal is due one month after successful payment." : overdue ? "The outstanding subscription balance is due now." : `Your subscription is active. Next payment: ${dateLabel(subscription?.next_payment_at)}.`}</p></div>
    {overdue ? <div className={styles.overdue}><strong>Payment Overdue</strong><p>Outstanding Amount: {amountInRand(monthlyAmount)}</p><p>Grace Period: {daysLeft} day{daysLeft === 1 ? "" : "s"} remaining</p></div> : null}
    {(onboarding || overdue) && checkoutReady && isBillingOwner ? <form action={onboarding ? startOnboardingCheckoutAction : startRecoveryCheckoutAction}>{onboarding ? <input type="hidden" name="expectedAmountCents" value={dueNow} /> : null}<button type="submit" className={styles.payButton}><ShieldCheck size={20} />{overdue ? "Pay Outstanding Balance" : "Pay securely with Paystack"}<ArrowRight size={22} /></button></form> : null}
    {account.status === "grace" && daysLeft > 0 ? <Link href={dashboard as never} className={styles.dashboardLink}>Continue to Dashboard</Link> : null}
    <div className={styles.security}><ShieldCheck size={25} /><p>Secure payment powered by Paystack.<br />You will be redirected to a secure checkout page to enter your card details.</p></div><div className={styles.paymentMarks}><span>VISA</span><span>●●</span><span>AMEX</span><span> Pay</span><span>G Pay</span><CreditCard size={27} /></div>
    {subscription?.card_last4 && isBillingOwner ? <form action={updatePaymentMethodAction}><button className={styles.cardUpdate}>Update payment card · {subscription.card_brand ?? "Card"} ending {subscription.card_last4}</button></form> : null}</aside></div>
    <section className={styles.history}><h2>Payment history</h2><p>Subscription status: <strong>{subscription?.status ?? "Awaiting onboarding"}</strong></p><ul>{payments?.length ? payments.map(payment => <li key={payment.id}><span className="capitalize">{payment.purpose} · {payment.status}</span><span>{amountInRand(payment.amount_cents)} · {dateLabel(payment.paid_at ?? payment.created_at)}</span></li>) : <li>No payments yet.</li>}</ul></section></div>
  </main>;
}
