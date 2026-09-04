import { NextResponse } from "next/server";
import { getManagerSubscriptionOverview, requireManagerSubscriptionSession } from "@/lib/manager/subscription";
import { assertRateLimit, verifyOrigin } from "@/lib/security";
import { stripeClient } from "@/lib/stripe/server";

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
    await assertRateLimit(`stripe:manager-portal:${session.authUserId}`, 8, 60_000);
    const state = await getManagerSubscriptionOverview(session);
    const customerId = state.record?.stripe_customer_id;
    if (!state.storageReady || !customerId) throw new Error("No Stripe customer is connected to this manager yet.");

    const origin = configuredAppOrigin(request);
    const portal = await stripeClient.createPortalSession({
      customerId,
      returnUrl: `${origin}/manager/subscription`
    });
    const portalUrl = typeof portal.url === "string" ? portal.url : null;
    if (!portalUrl) throw new Error("Stripe did not return a Customer Portal URL.");
    return NextResponse.redirect(portalUrl, 303);
  } catch (error) {
    console.error("manager_subscription_portal_failed", error);
    const origin = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (origin) return NextResponse.redirect(`${new URL(origin).origin}/manager/subscription?billing_error=portal`, 303);
    return NextResponse.json({ error: "Unable to open the secure billing portal." }, { status: 500 });
  }
}
