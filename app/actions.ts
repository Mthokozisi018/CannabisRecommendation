"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addItemToCart, saveDraftCart, updateCartItem } from "@/lib/dal/carts";
import { requireStaff, switchActiveStore } from "@/lib/dal/auth";
import { validateProductImport } from "@/lib/dal/imports";
import { writeAuditEvent } from "@/lib/logger";
import { assertRateLimit, verifyOrigin } from "@/lib/security";
import { addToCartSchema, importPayloadSchema, saveCartSchema, updateCartItemSchema } from "@/lib/schemas/cart";
import { startRecommendationSchema, storeSwitchSchema } from "@/lib/schemas/shared";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

export async function startRecommendationSession(formData: FormData) {
  const staff = await requireStaff();
  const parsed = startRecommendationSchema.parse({ effect: formValue(formData, "effect") ?? "relaxed" });
  await writeAuditEvent({
    interactionId: crypto.randomUUID(),
    actorId: staff.id,
    tenantId: staff.storeId,
    action: "recommendation.start",
    targetType: "recommendation_session",
    result: "success",
    metadata: { effect: parsed.effect }
  });
  redirect(`/browse?effect=${encodeURIComponent(parsed.effect)}`);
}

export async function switchStoreAction(formData: FormData) {
  await verifyOrigin();
  const staff = await requireStaff();
  const parsed = storeSwitchSchema.parse({ storeId: formValue(formData, "storeId") });
  await switchActiveStore(parsed.storeId);
  await writeAuditEvent({
    interactionId: crypto.randomUUID(),
    actorId: staff.id,
    tenantId: parsed.storeId,
    action: "store.switch",
    targetType: "store",
    targetId: parsed.storeId,
    result: "success"
  });
  revalidatePath("/");
  redirect("/");
}

export async function addToCartAction(formData: FormData) {
  const interactionId = crypto.randomUUID();
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
  await writeAuditEvent({ interactionId, actorId: staff.id, tenantId: staff.storeId, action: "cart.item.add", targetType: "cart", targetId: cart.id, result: "success" });
  revalidatePath("/browse");
  revalidatePath("/products");
}

export async function updateCartItemAction(formData: FormData) {
  const interactionId = crypto.randomUUID();
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
  await writeAuditEvent({ interactionId, actorId: staff.id, tenantId: staff.storeId, action: "cart.item.update", targetType: "cart", targetId: cart.id, result: "success" });
  revalidatePath(`/carts/${cart.id}`);
  revalidatePath("/browse");
}

export async function saveCartAction(formData: FormData) {
  const interactionId = crypto.randomUUID();
  await verifyOrigin();
  const staff = await requireStaff(["admin", "receptionist", "catalog_manager"]);
  assertRateLimit(`cart:save:${staff.id}`, 30);
  const parsed = saveCartSchema.parse({
    cartId: formValue(formData, "cartId"),
    note: formValue(formData, "note")
  });
  const cart = await saveDraftCart(parsed);
  if (!cart) throw new Error("Unable to save draft cart.");
  await writeAuditEvent({ interactionId, actorId: staff.id, tenantId: staff.storeId, action: "cart.save", targetType: "cart", targetId: cart.id, result: "success" });
  revalidatePath(`/carts/${cart.id}`);
  redirect(`/carts/${cart.id}`);
}

export async function importProductsAction(formData: FormData) {
  const interactionId = crypto.randomUUID();
  await verifyOrigin();
  const staff = await requireStaff(["admin", "catalog_manager"]);
  assertRateLimit(`admin:import:${staff.id}`, 6, 60_000);
  const parsed = importPayloadSchema.parse({ mode: formValue(formData, "mode") ?? "dry_run", json: formValue(formData, "json") });
  const result = await validateProductImport(parsed);
  await writeAuditEvent({
    interactionId,
    actorId: staff.id,
    tenantId: staff.storeId,
    action: parsed.mode === "commit" ? "product_import.commit" : "product_import.dry_run",
    targetType: "import_job",
    targetId: result.jobId,
    result: result.errors.length ? "validation_error" : "success",
    metadata: { validRows: result.validRows, errorCount: result.errors.length }
  });
  revalidatePath("/admin/products");
}
