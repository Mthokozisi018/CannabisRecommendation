import { NextResponse } from "next/server";
import { getManagerSubscriptionOverview, requireManagerSubscriptionSession } from "@/lib/manager/subscription";
import { assertRateLimit, verifyOrigin } from "@/lib/security";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { stripeClient, stripeStringId } from "@/lib/stripe/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function configuredAppOrigin(request: Request) {
  const configured = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return new URL(configured).origin;
  if (process.env.NODE_ENV !== "production") return new URL(request.url).origin;
  throw new Error("Application URL is not configured.");
}

export async function POST(request: Request) {
  try {
    await verifyOrigin();
    const session = await requireManagerSubscriptionSession();
    await assertRateLimit(`stripe:manager-checkout:${session.authUserId}`, 5, 60_000);

    const priceId = process.env.STRIPE_MANAGER_PRICE_ID?.trim();
    if (!priceId) throw new Error("STRIPE_MANAGER_PRICE_ID is not configured.");

    const state = await getManagerSubscriptionOverview(session);
    if (!state.storageReady || !state.record) throw new Error("Manager subscription storage is not initialized.");
    const record = state.record;

    if (record.stripe_subscription_id && record.payment_method_ready) {
      const origin = configuredAppOrigin(request);
      return NextResponse.redirect(`${origin}/manager/subscription?already_setup=1`, 303);
    }

    const admin = createSupabaseAdminClient();
    if (!admin) throw new Error("Supabase server billing access is not configured.");

    let customerId = record.stripe_customer_id;
    if (!customerId) {
      const customer = await stripeClient.createCustomer({
        email: session.email,
        name: session.displayName,
        storeId: session.storeId,
        managerAuthUserId: session.authUserId
      });
      customerId = stripeStringId(customer.id);
      if (!customerId) throw new Error("Stripe did not return a customer ID.");

      const { error } = await admin
        .from("manager_subscriptions")
        .update({ stripe_customer_id: customerId, stripe_price_id: priceId, updated_at: new Date().toISOString() })
        .eq("id", record.id);
      if (error) throw new Error(error.message);
    }

    const origin = configuredAppOrigin(request);
    const trialEndMs = new Date(record.trial_ends_at).getTime();
    const trialEndUnix = Number.isFinite(trialEndMs) && trialEndMs > Date.now()
      ? Math.floor(trialEndMs / 1000)
      : undefined;

    const checkout = await stripeClient.createSubscriptionCheckout({
      customerId,
      priceId,
      storeId: session.storeId,
      managerAuthUserId: session.authUserId,
      successUrl: `${origin}/manager/subscription?checkout=success`,
      cancelUrl: `${origin}/manager/subscription?checkout=cancelled`,
      trialEndUnix
    });

    const checkoutId = stripeStringId(checkout.id);
    const checkoutUrl = typeof checkout.url === "string" ? checkout.url : null;
    if (!checkoutId || !checkoutUrl) throw new Error("Stripe Checkout did not return a redirect URL.");

    const { error: updateError } = await admin
      .from("manager_subscriptions")
      .update({
        stripe_checkout_session_id: checkoutId,
        stripe_price_id: priceId,
        updated_at: new Date().toISOString()
      })
      .eq("id", record.id);
    if (updateError) throw new Error(updateError.message);

    return NextResponse.redirect(checkoutUrl, 303);
  } catch (error) {
    console.error("manager_subscription_checkout_failed", error);
    const origin = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (origin) return NextResponse.redirect(`${new URL(origin).origin}/manager/subscription?billing_error=checkout`, 303);
    return NextResponse.json({ error: "Unable to open secure subscription checkout." }, { status: 500 });
  }
}
