import { NextRequest, NextResponse } from "next/server";
import { addItemToCart } from "@/lib/dal/carts";
import { requireStaff } from "@/lib/dal/auth";
import { addToCartSchema } from "@/lib/schemas/cart";
import { assertRateLimit, verifyCsrfToken, verifyOrigin } from "@/lib/security";

export async function POST(request: NextRequest) {
  try {
    await verifyOrigin();
    const csrfToken = request.cookies.get("csrf_token")?.value ?? null;
    const csrfSignature = request.headers.get("x-csrf-signature");
    if (!verifyCsrfToken(csrfToken, csrfSignature)) {
      return NextResponse.json({ error: "Invalid CSRF token." }, { status: 403 });
    }
    const staff = await requireStaff(["admin", "receptionist", "catalog_manager"]);
    assertRateLimit(`api:cart:${staff.id}`, 40);
    const payload = addToCartSchema.parse(await request.json());
    const cart = await addItemToCart(payload);
    if (!cart) throw new Error("Unable to create draft cart.");
    return NextResponse.json({ cartId: cart.id, itemCount: cart.items.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to mutate cart." }, { status: 400 });
  }
}
