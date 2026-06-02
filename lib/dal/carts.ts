import "server-only";
import type { CartDTO } from "@/lib/types";
import { getProductById } from "./catalog";
import { requireStaff } from "./auth";

const carts = new Map<string, CartDTO>();

function id() {
  return crypto.randomUUID();
}

export async function getActiveCart(cartId?: string): Promise<CartDTO> {
  const staff = await requireStaff();
  if (cartId) {
    const existing = carts.get(cartId);
    if (existing && existing.storeId === staff.storeId) return existing;
  }
  const createdAt = new Date().toISOString();
  const cart: CartDTO = { id: id(), storeId: staff.storeId, status: "draft", items: [], createdAt, updatedAt: createdAt };
  carts.set(cart.id, cart);
  return cart;
}

export async function getSavedCart(cartId: string): Promise<CartDTO | null> {
  const staff = await requireStaff();
  const cart = carts.get(cartId);
  if (!cart || cart.storeId !== staff.storeId) return null;
  return cart;
}

export async function addItemToCart(input: { cartId?: string; productId: string; quantity: number; note?: string }): Promise<CartDTO> {
  const cart = await getActiveCart(input.cartId);
  const product = await getProductById(input.productId);
  if (!product) throw new Error("Product not found.");
  const existing = cart.items.find((item) => item.product.id === input.productId);
  if (existing) {
    existing.quantity += input.quantity;
    existing.note = input.note ?? existing.note;
  } else {
    cart.items.push({ id: id(), product, quantity: input.quantity, unitPriceCents: product.priceCents, note: input.note });
  }
  cart.updatedAt = new Date().toISOString();
  carts.set(cart.id, cart);
  return cart;
}

export async function updateCartItem(input: { cartId: string; itemId: string; quantity: number; note?: string }): Promise<CartDTO> {
  const cart = await getActiveCart(input.cartId);
  const item = cart.items.find((candidate) => candidate.id === input.itemId);
  if (!item) throw new Error("Cart item not found.");
  if (input.quantity === 0) {
    cart.items = cart.items.filter((candidate) => candidate.id !== input.itemId);
  } else {
    item.quantity = input.quantity;
    item.note = input.note ?? item.note;
  }
  cart.updatedAt = new Date().toISOString();
  carts.set(cart.id, cart);
  return cart;
}

export async function saveDraftCart(input: { cartId: string; note?: string }): Promise<CartDTO> {
  const cart = await getActiveCart(input.cartId);
  cart.status = "saved";
  cart.note = input.note;
  cart.updatedAt = new Date().toISOString();
  carts.set(cart.id, cart);
  return cart;
}
