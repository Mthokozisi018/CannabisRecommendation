"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { addItemToCart, saveDraftCart, updateCartItem } from "@/lib/dal/carts";
import { requirePermission, requireStaff, switchActiveStore } from "@/lib/dal/auth";
import { validateProductImport } from "@/lib/dal/imports";
import { writeAuditEvent } from "@/lib/logger";
import { assertRateLimit, verifyOrigin } from "@/lib/security";
import { addToCartSchema, importPayloadSchema, saveCartSchema, updateCartItemSchema } from "@/lib/schemas/cart";
import { startRecommendationSchema, storeSwitchSchema } from "@/lib/schemas/shared";
import { customerContext } from "@/lib/account-data";
import { assertPermission } from "@/lib/authorization";
import { djangoRoleToStaffRole, setStaffSession } from "@/lib/staff-session";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

function greenChoiceApiBaseUrl() {
  return (process.env.GREENCHOICE_API_BASE_URL || "http://127.0.0.1:8000/api/v2").replace(/\/$/, "");
}

function cookieValue(setCookies: string[], name: string) {
  for (const setCookie of setCookies) {
    const match = setCookie.match(new RegExp(`${name}=([^;,\r\n]+)`));
    if (match?.[1]) return match[1];
  }
  return undefined;
}

function responseSetCookies(headers: Headers) {
  const withGetSetCookie = headers as Headers & { getSetCookie?: () => string[] };
  const cookies = withGetSetCookie.getSetCookie?.();
  if (cookies?.length) return cookies;
  const combined = headers.get("set-cookie");
  return combined ? [combined] : [];
}

export async function loginGreenChoiceStaffAction(formData: FormData) {
  const email = formValue(formData, "email")?.toLowerCase().trim() ?? "";
  const password = formValue(formData, "password") ?? "";

  let response: Response;
  try {
    response = await fetch(`${greenChoiceApiBaseUrl()}/auth/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store"
    });
  } catch {
    redirect("/login?error=unavailable");
  }

  if (!response.ok) {
    redirect("/login?error=invalid");
  }

  const setCookies = responseSetCookies(response.headers);
  const djangoSessionId = cookieValue(setCookies, "sessionid");
  const djangoCsrfToken = cookieValue(setCookies, "csrftoken");
  const store = await cookies();
  if (djangoSessionId) {
    store.set("sessionid", djangoSessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 14
    });
  }
  if (djangoCsrfToken) {
    store.set("csrftoken", djangoCsrfToken, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 14
    });
  }

  const payload = await response.json();
  const user = payload?.data?.user;
  const role = djangoRoleToStaffRole(user?.role);
  if (!user?.id || !user?.email || !role) {
    redirect("/login?error=staff");
  }

  await setStaffSession({
    id: String(user.id),
    email: user.email,
    displayName: user.fullName || user.email,
    role
  });

  redirect(role === "manager" ? "/dashboard/manager" : "/dashboard/receptionist");
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

export async function registerCustomerAction(formData: FormData) {
  await verifyOrigin();
  assertRateLimit("account:register:customer", 8, 60_000);
  const email = formValue(formData, "email") ?? "";
  const firstName = formValue(formData, "firstName") ?? "";
  const location = formValue(formData, "location") ?? "South Africa";
  assertPermission({ ...customerContext, assignments: [{ role: "guest", scope: "self" }] }, "account.register");
  await writeAuditEvent({
    interactionId: crypto.randomUUID(),
    actorId: customerContext.userId ?? "self-service",
    tenantId: customerContext.tenantId ?? "self-service",
    action: "customer.register.pending_verification",
    targetType: "user",
    targetId: customerContext.userId,
    result: email && firstName ? "success" : "validation_error",
    metadata: { location, marketingOptIn: formData.get("marketingOptIn") === "on" }
  });
  redirect("/account/privacy" as never);
}

export async function submitPrivacyRequestAction(formData: FormData) {
  await verifyOrigin();
  assertPermission(customerContext, "privacy.manage_self", { ownerUserId: customerContext.userId });
  const requestType = formValue(formData, "requestType") ?? "download";
  await writeAuditEvent({
    interactionId: crypto.randomUUID(),
    actorId: customerContext.userId ?? "self-service",
    tenantId: customerContext.tenantId ?? "self-service",
    action: "privacy_request.created",
    targetType: "privacy_request",
    result: "success",
    metadata: { requestType }
  });
  revalidatePath("/account/privacy");
}

export async function requestRoleChangeAction(formData: FormData) {
  await verifyOrigin();
  const { staff, context } = await requirePermission("roles.manage.tenant");
  const targetRole = formValue(formData, "role") ?? "employee_receptionist";
  await writeAuditEvent({
    interactionId: crypto.randomUUID(),
    actorId: staff.id,
    tenantId: staff.storeId,
    action: "role.assignment.requested",
    targetType: "role_assignment",
    result: "success",
    metadata: { targetRole, reason: "step-up required before commit" }
  });
  assertPermission(context, "audit.view.tenant", { tenantId: staff.storeId });
  revalidatePath("/account/roles");
}
