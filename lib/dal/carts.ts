import "server-only";
import type { CartDTO } from "@/lib/types";
import { getProductById } from "./catalog";
import { requireStaff } from "./auth";
import { assertObjectStore } from "@/lib/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionState, updateSessionState } from "@/lib/session";

const localCarts = new Map<string, CartDTO>();

function assertLocalPreviewOnly() {
  if (process.env.NODE_ENV === "production") throw new Error("Persistent database configuration is required for cart mutations.");
}

function id() {
  return crypto.randomUUID();
}

async function mapCart(cart: any): Promise<CartDTO> {
  const items = await Promise.all(
    (cart.cart_items ?? []).map(async (item: any) => {
      const product = await getProductById(item.product_id);
      if (!product) return null;
      return {
        id: item.id,
        product,
        quantity: item.quantity,
        unitPriceCents: item.unit_price_cents,
        note: item.note ?? undefined
      };
    })
  );
  return {
    id: cart.id,
    storeId: cart.store_id,
    recommendationSessionId: cart.recommendation_session_id ?? undefined,
    status: cart.status,
    note: cart.note ?? undefined,
    items: items.filter(Boolean) as CartDTO["items"],
    createdAt: cart.created_at,
    updatedAt: cart.updated_at
  };
}

async function fetchCart(cartId: string, storeId: string): Promise<CartDTO | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    assertLocalPreviewOnly();
    const cart = localCarts.get(cartId);
    return cart && cart.storeId === storeId ? cart : null;
  }
  const { data, error } = await supabase
    .from("carts")
    .select("id,store_id,recommendation_session_id,status,note,created_at,updated_at,cart_items(id,product_id,quantity,unit_price_cents,note)")
    .eq("id", cartId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) throw new Error("Unable to read cart.");
  return data ? mapCart(data) : null;
}

async function createCart(storeId: string, actorId: string): Promise<CartDTO> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    assertLocalPreviewOnly();
    const createdAt = new Date().toISOString();
    const cart: CartDTO = { id: id(), storeId, status: "draft", items: [], createdAt, updatedAt: createdAt };
    localCarts.set(cart.id, cart);
    await updateSessionState({ activeCartId: cart.id });
    return cart;
  }
  const { data, error } = await supabase
    .from("carts")
    .insert({ store_id: storeId, created_by_user_id: actorId, status: "draft" })
    .select("id,store_id,recommendation_session_id,status,note,created_at,updated_at,cart_items(id,product_id,quantity,unit_price_cents,note)")
    .single();
  if (error || !data) throw new Error("Unable to create cart.");
  await updateSessionState({ activeCartId: data.id });
  return mapCart(data);
}

export async function getActiveCart(cartId?: string): Promise<CartDTO> {
  const staff = await requireStaff();
  const session = await getSessionState();
  const candidateId = cartId ?? session.activeCartId;
  if (candidateId) {
    const existing = await fetchCart(candidateId, staff.storeId);
    if (existing && existing.status === "draft") return existing;
  }
  return createCart(staff.storeId, staff.id);
}

export async function getSavedCart(cartId: string): Promise<CartDTO | null> {
  const staff = await requireStaff();
  const cart = await fetchCart(cartId, staff.storeId);
  if (!cart) return null;
  assertObjectStore(staff, cart.storeId);
  return cart.status === "saved" ? cart : null;
}

export async function addItemToCart(input: { cartId?: string; productId: string; quantity: number; note?: string }): Promise<CartDTO> {
  const staff = await requireStaff();
  const cart = await getActiveCart(input.cartId);
  assertObjectStore(staff, cart.storeId);
  const product = await getProductById(input.productId);
  if (!product || product.storeId !== staff.storeId) throw new Error("Product not found.");

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    assertLocalPreviewOnly();
    const existing = cart.items.find((item) => item.product.id === input.productId);
    if (existing) {
      existing.quantity = Math.min(99, existing.quantity + input.quantity);
      existing.note = input.note ?? existing.note;
    } else {
      cart.items.push({ id: id(), product, quantity: input.quantity, unitPriceCents: product.priceCents, note: input.note });
    }
    cart.updatedAt = new Date().toISOString();
    localCarts.set(cart.id, cart);
    return cart;
  }

  const existing = cart.items.find((item) => item.product.id === input.productId);
  if (existing) {
    const { error } = await supabase
      .from("cart_items")
      .update({ quantity: Math.min(99, existing.quantity + input.quantity), note: input.note ?? existing.note ?? null, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw new Error("Unable to update cart item.");
  } else {
    const { error } = await supabase.from("cart_items").insert({
      cart_id: cart.id,
      product_id: product.id,
      quantity: input.quantity,
      unit_price_cents: product.priceCents,
      note: input.note ?? null
    });
    if (error) throw new Error("Unable to add cart item.");
  }
  await supabase.from("carts").update({ updated_at: new Date().toISOString() }).eq("id", cart.id);
  return (await fetchCart(cart.id, staff.storeId)) ?? cart;
}

export async function updateCartItem(input: { cartId: string; itemId: string; quantity: number; note?: string }): Promise<CartDTO> {
  const staff = await requireStaff();
  const cart = await getActiveCart(input.cartId);
  assertObjectStore(staff, cart.storeId);
  const item = cart.items.find((candidate) => candidate.id === input.itemId);
  if (!item) throw new Error("Cart item not found.");

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    assertLocalPreviewOnly();
    cart.items = input.quantity === 0
      ? cart.items.filter((candidate) => candidate.id !== input.itemId)
      : cart.items.map((candidate) => candidate.id === input.itemId ? { ...candidate, quantity: input.quantity, note: input.note ?? candidate.note } : candidate);
    cart.updatedAt = new Date().toISOString();
    localCarts.set(cart.id, cart);
    return cart;
  }

  const result = input.quantity === 0
    ? await supabase.from("cart_items").delete().eq("id", input.itemId)
    : await supabase.from("cart_items").update({ quantity: input.quantity, note: input.note ?? item.note ?? null, updated_at: new Date().toISOString() }).eq("id", input.itemId);
  if (result.error) throw new Error("Unable to update cart item.");
  await supabase.from("carts").update({ updated_at: new Date().toISOString() }).eq("id", cart.id);
  return (await fetchCart(cart.id, staff.storeId)) ?? cart;
}

export async function saveDraftCart(input: { cartId: string; note?: string }): Promise<CartDTO> {
  const staff = await requireStaff();
  const cart = await getActiveCart(input.cartId);
  assertObjectStore(staff, cart.storeId);

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    assertLocalPreviewOnly();
    cart.status = "saved";
    cart.note = input.note;
    cart.updatedAt = new Date().toISOString();
    localCarts.set(cart.id, cart);
    await updateSessionState({ activeCartId: undefined });
    return cart;
  }

  const { error } = await supabase.from("carts").update({ status: "saved", note: input.note ?? null, updated_at: new Date().toISOString() }).eq("id", cart.id).eq("store_id", staff.storeId);
  if (error) throw new Error("Unable to save draft cart.");
  await updateSessionState({ activeCartId: undefined });
  return (await fetchCart(cart.id, staff.storeId)) ?? cart;
}
