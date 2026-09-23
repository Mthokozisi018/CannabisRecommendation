import { NextResponse } from "next/server";
import { z } from "zod";
import { getCustomerSession } from "@/lib/customer/auth";
import { readCustomerCart } from "@/lib/customer/cart";
import { requireRateLimit, trustedClientIp } from "@/lib/rate-limit";
import { verifyOrigin } from "@/lib/security";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0", "Vary": "Cookie, Authorization" };
const addSchema = z.object({ productId: z.string().uuid(), storeId: z.string().uuid() }).strict();
const updateSchema = z.object({ itemId: z.string().uuid(), quantity: z.number().int().min(0).max(99) }).strict();

async function activeCustomer() {
  const session = await getCustomerSession();
  return session?.profile.status === "active" ? session : null;
}

export async function GET() {
  const customer = await activeCustomer();
  if (!customer) return NextResponse.json({ error: "Customer authentication required." }, { status: 401, headers });
  return NextResponse.json(await readCustomerCart(customer.user.id), { headers });
}

export async function POST(request: Request) {
  try {
    await verifyOrigin();
    const customer = await activeCustomer();
    if (!customer) return NextResponse.json({ error: "Customer authentication required." }, { status: 401, headers });
    await requireRateLimit({ namespace: "customer-cart", identifiers: [customer.user.id, trustedClientIp(request.headers)], limit: 120, windowMs: 60_000 });
    const parsed = addSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid product." }, { status: 400, headers });
    const admin = createSupabaseAdminClient();
    if (!admin) return NextResponse.json({ error: "Cart service unavailable." }, { status: 503, headers });

    const { data: product, error: productError } = await admin
      .from("products")
      .select("id,store_id,price,product_status,is_visible_on_pos,is_published,deleted_at")
      .eq("id", parsed.data.productId)
      .maybeSingle();
    if (productError) throw productError;
    const { data: store, error: storeError } = await admin
      .from("stores")
      .select("id,is_active,store_access_status")
      .eq("id", parsed.data.storeId)
      .maybeSingle();
    if (storeError) throw storeError;
    const fulfillmentResult = await admin.from("store_fulfillment_settings").select("orders_enabled").eq("store_id", parsed.data.storeId).maybeSingle();
    if (fulfillmentResult.error && !/store_fulfillment_settings|schema cache/i.test(fulfillmentResult.error.message)) throw fulfillmentResult.error;
    const { data: stock, error: stockError } = await admin
      .from("inventory_stock")
      .select("id,current_quantity")
      .eq("product_id", parsed.data.productId)
      .eq("store_id", parsed.data.storeId)
      .maybeSingle();
    if (stockError) throw stockError;
    if (!product || !store || fulfillmentResult.data?.orders_enabled === false || product.deleted_at || product.product_status !== "active" || product.is_visible_on_pos === false || product.is_published === false || store.is_active !== true || store.store_access_status !== "active" || Number(stock?.current_quantity ?? 0) < 1) {
      return NextResponse.json({ error: "This product is currently unavailable." }, { status: 409, headers });
    }

    let cart = await readCustomerCart(customer.user.id);
    if (cart.id && cart.storeId !== parsed.data.storeId && cart.items.length > 0) {
      return NextResponse.json({ error: "Your cart contains products from another store. Clear that cart before choosing a different store." }, { status: 409, headers });
    }
    if (!cart.id) {
      const { data: created, error } = await admin.from("carts").insert({ store_id: parsed.data.storeId, created_by_user_id: customer.user.id, status: "draft" }).select("id").single();
      if (error || !created) throw error ?? new Error("Unable to create cart.");
      cart = { ...cart, id: created.id, storeId: parsed.data.storeId };
    } else if (cart.storeId !== parsed.data.storeId) {
      const { error } = await admin.from("carts").update({ store_id: parsed.data.storeId, updated_at: new Date().toISOString() }).eq("id", cart.id).eq("created_by_user_id", customer.user.id);
      if (error) throw error;
    }

    const existing = cart.items.find((item) => item.productId === product.id);
    if (existing) {
      if (existing.quantity >= Number(stock?.current_quantity ?? 0)) return NextResponse.json({ error: "The selected quantity exceeds available stock." }, { status: 409, headers });
      const { error } = await admin.from("cart_items").update({ quantity: existing.quantity + 1, unit_price_cents: Math.round(Number(product.price) * 100), updated_at: new Date().toISOString() }).eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await admin.from("cart_items").insert({ cart_id: cart.id, product_id: product.id, quantity: 1, unit_price_cents: Math.round(Number(product.price) * 100) });
      if (error) throw error;
    }
    await admin.from("carts").update({ updated_at: new Date().toISOString() }).eq("id", cart.id);
    return NextResponse.json(await readCustomerCart(customer.user.id), { headers });
  } catch {
    return NextResponse.json({ error: "We could not update your cart." }, { status: 500, headers });
  }
}

export async function PATCH(request: Request) {
  try {
    await verifyOrigin();
    const customer = await activeCustomer();
    if (!customer) return NextResponse.json({ error: "Customer authentication required." }, { status: 401, headers });
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid cart update." }, { status: 400, headers });
    const admin = createSupabaseAdminClient();
    if (!admin) return NextResponse.json({ error: "Cart service unavailable." }, { status: 503, headers });
    const cart = await readCustomerCart(customer.user.id);
    const item = cart.items.find((candidate) => candidate.id === parsed.data.itemId);
    if (!cart.id || !item) return NextResponse.json({ error: "Cart item not found." }, { status: 404, headers });
    if (parsed.data.quantity > item.stockAvailable) return NextResponse.json({ error: "The selected quantity exceeds available stock." }, { status: 409, headers });
    const result = parsed.data.quantity === 0
      ? await admin.from("cart_items").delete().eq("id", item.id).eq("cart_id", cart.id)
      : await admin.from("cart_items").update({ quantity: parsed.data.quantity, updated_at: new Date().toISOString() }).eq("id", item.id).eq("cart_id", cart.id);
    if (result.error) throw result.error;
    await admin.from("carts").update({ updated_at: new Date().toISOString() }).eq("id", cart.id).eq("created_by_user_id", customer.user.id);
    return NextResponse.json(await readCustomerCart(customer.user.id), { headers });
  } catch {
    return NextResponse.json({ error: "We could not update your cart." }, { status: 500, headers });
  }
}

export async function DELETE() {
  try {
    await verifyOrigin();
    const customer = await activeCustomer();
    if (!customer) return NextResponse.json({ error: "Customer authentication required." }, { status: 401, headers });
    const admin = createSupabaseAdminClient();
    if (!admin) return NextResponse.json({ error: "Cart service unavailable." }, { status: 503, headers });
    const cart = await readCustomerCart(customer.user.id);
    if (cart.id) {
      const { error } = await admin.from("cart_items").delete().eq("cart_id", cart.id);
      if (error) throw error;
      await admin.from("carts").update({ updated_at: new Date().toISOString() }).eq("id", cart.id).eq("created_by_user_id", customer.user.id);
    }
    return NextResponse.json(await readCustomerCart(customer.user.id), { headers });
  } catch {
    return NextResponse.json({ error: "We could not clear your cart." }, { status: 500, headers });
  }
}
