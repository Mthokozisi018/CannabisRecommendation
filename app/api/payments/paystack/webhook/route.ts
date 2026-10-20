import { billingEnabled } from "@/lib/billing/accounts";
import { processPaystackEvent } from "@/lib/billing/events";
import { verifyPaystackWebhookSignature } from "@/lib/billing/paystack";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!billingEnabled()) return new Response(null, { status: 404 });
  const raw = Buffer.from(await request.arrayBuffer());
  if (raw.length > 1024 * 1024) return new Response(null, { status: 413 });
  if (!verifyPaystackWebhookSignature(raw, request.headers.get("x-paystack-signature"))) {
    return new Response(null, { status: 401 });
  }
  try {
    await processPaystackEvent(raw);
    return new Response(null, { status: 200 });
  } catch {
    return new Response(null, { status: 500 });
  }
}
