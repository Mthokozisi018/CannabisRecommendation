"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addItemToCart, saveDraftCart, updateCartItem } from "@/lib/dal/carts";
import { requireStaff } from "@/lib/dal/auth";
import { assertRateLimit, verifyOrigin } from "@/lib/security";
import { addToCartSchema, importPayloadSchema, saveCartSchema, updateCartItemSchema } from "@/lib/schemas/cart";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

export async function startRecommendationSession(formData: FormData) {
  await requireStaff();
  const effect = formValue(formData, "effect") ?? "relaxed";
  redirect(`/browse?effect=${encodeURIComponent(effect)}`);
}

export async function addToCartAction(formData: FormData) {
  await verifyOrigin();
  const staff = await requireStaff(["admin", "receptionist", "catalog_manager"]);
  assertRateLimit(`cart:add:${staff.id}`, 60);
  const parsed = addToCartSchema.parse({
    cartId: formValue(formData, "cartId") || undefined,
    productId: formValue(formData, "productId"),
    quantity: formValue(formData, "quantity") ?? 1,
    note: formValue(formData, "note")
  });
  const cart = await addItemToCart(parsed);
  if (!cart) throw new Error("Unable to create draft cart.");
  revalidatePath("/browse");
  revalidatePath("/products");
  return { cartId: cart.id, itemCount: cart.items.length };
}

export async function updateCartItemAction(formData: FormData) {
  await verifyOrigin();
  const staff = await requireStaff(["admin", "receptionist", "catalog_manager"]);
  assertRateLimit(`cart:update:${staff.id}`, 90);
  const parsed = updateCartItemSchema.parse({
    cartId: formValue(formData, "cartId"),
    itemId: formValue(formData, "itemId"),
    quantity: formValue(formData, "quantity"),
    note: formValue(formData, "note")
  });
  const cart = await updateCartItem(parsed);
  if (!cart) throw new Error("Unable to update draft cart.");
  revalidatePath(`/carts/${cart.id}`);
  return { cartId: cart.id, itemCount: cart.items.length };
}

export async function saveCartAction(formData: FormData) {
  await verifyOrigin();
  const staff = await requireStaff(["admin", "receptionist", "catalog_manager"]);
  assertRateLimit(`cart:save:${staff.id}`, 30);
  const parsed = saveCartSchema.parse({
    cartId: formValue(formData, "cartId"),
    note: formValue(formData, "note")
  });
  const cart = await saveDraftCart(parsed);
  if (!cart) throw new Error("Unable to save draft cart.");
  revalidatePath(`/carts/${cart.id}`);
  redirect(`/carts/${cart.id}`);
}

export async function importProductsAction(formData: FormData) {
  await verifyOrigin();
  const staff = await requireStaff(["admin"]);
  assertRateLimit(`admin:import:${staff.id}`, 6, 60_000);
  const parsed = importPayloadSchema.parse({ json: formValue(formData, "json") });
  JSON.parse(parsed.json);
  revalidatePath("/admin/products");
}
