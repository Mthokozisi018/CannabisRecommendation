import { NextRequest, NextResponse } from "next/server";
import { addItemToCart } from "@/lib/dal/carts";
import { requireStaff } from "@/lib/dal/auth";
import { writeAuditEvent } from "@/lib/logger";
import { addToCartSchema } from "@/lib/schemas/cart";
import { assertRateLimit, verifyCsrfToken, verifyOrigin } from "@/lib/security";

export async function POST(request: NextRequest) {
  const interactionId = crypto.randomUUID();
  let staff: Awaited<ReturnType<typeof requireStaff>> | null = null;
  try {
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return NextResponse.json({ error: "Invalid request." }, { status: 415 });
    }
    await verifyOrigin();
    const csrfToken = request.cookies.get("csrf_token")?.value ?? null;
    const csrfSignature = request.headers.get("x-csrf-signature");
    if (!verifyCsrfToken(csrfToken, csrfSignature)) {
      return NextResponse.json({ error: "Invalid CSRF token." }, { status: 403 });
    }
    staff = await requireStaff(["admin", "receptionist", "catalog_manager"]);
    await assertRateLimit(`api:cart:${staff.id}`, 40);
    const payload = addToCartSchema.parse(await request.json());
    const cart = await addItemToCart(payload);
    if (!cart) throw new Error("Unable to create draft cart.");
    await writeAuditEvent({ interactionId, actorId: staff.id, tenantId: staff.storeId, action: "api.cart.item.add", targetType: "cart", targetId: cart.id, result: "success" });
    return NextResponse.json({ cartId: cart.id, itemCount: cart.items.length });
  } catch (error) {
    if (staff) {
      await writeAuditEvent({ interactionId, actorId: staff.id, tenantId: staff.storeId, action: "api.cart.item.add", targetType: "cart", result: "failure", metadata: { reason: error instanceof Error ? error.message : "unknown" } });
    }
    return NextResponse.json({ error: "Unable to mutate cart." }, { status: 400 });
  }
}
