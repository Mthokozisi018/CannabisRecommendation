"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCustomerSession } from "@/lib/customer/auth";
import { addressFormValues, addressRecord, customerAddressSchema } from "@/lib/customer/address-validation";
import { readCustomerCart } from "@/lib/customer/cart";
import { logServerEvent } from "@/lib/logger";
import { normalizeSouthAfricanPhone, SOUTH_AFRICAN_PROVINCES } from "@/lib/customer/validation";
import { verifyOrigin } from "@/lib/security";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

function value(form: FormData, key: string) { const entry = form.get(key); return typeof entry === "string" ? entry.trim() : ""; }

const checkoutDetailsSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  surname: z.string().trim().min(1).max(80),
  phoneNumber: z.string().trim().min(9).max(20),
  addressLine: z.string().trim().max(180).optional().default(""),
  suburb: z.string().trim().max(100).optional().default(""),
  city: z.string().trim().max(100).optional().default(""),
  province: z.string().trim().max(80).optional().default(""),
  postalCode: z.string().trim().max(4).optional().default(""),
  deliveryInstructions: z.string().trim().max(500).optional().default(""),
  saveAddress: z.boolean().optional().default(false)
});
const placeOrderSchema = z.object({
  paymentMethod: z.enum(["card", "cash"]),
  fulfillmentType: z.enum(["collection", "delivery"]),
  idempotencyKey: z.string().uuid(),
  customerDetails: checkoutDetailsSchema
}).strict().superRefine((input, context) => {
  if (input.fulfillmentType !== "delivery") return;
  for (const key of ["addressLine", "suburb", "city", "province", "postalCode"] as const) {
    if (!input.customerDetails[key]) context.addIssue({ code: z.ZodIssueCode.custom, path: ["customerDetails", key], message: "Delivery address is required." });
  }
  if (!/^\d{4}$/.test(input.customerDetails.postalCode)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["customerDetails", "postalCode"], message: "Enter a valid postal code." });
  }
});

export type PlaceCustomerOrderResult = { ok: boolean; message: string; orderId?: string; orderNumber?: string };

const CART_VALIDATION_ERRORS = [
  "cart is not available",
  "cart is empty",
  "product is no longer available",
  "product price changed",
  "insufficient stock",
  "stock changed during checkout",
];

function isMissingCheckoutSchemaError(code: string | undefined, message: string) {
  return code === "PGRST202"
    || message.includes("place_customer_order_v2")
    || message.includes("schema cache");
}

function isCartValidationError(message: string) {
  return CART_VALIDATION_ERRORS.some((reason) => message.includes(reason));
}

export async function placeCustomerOrderAction(input: unknown): Promise<PlaceCustomerOrderResult> {
  try {
    await verifyOrigin();
    const session = await requireCustomerSession();
    const parsed = placeOrderSchema.parse(input);
    const phoneNumber = normalizeSouthAfricanPhone(parsed.customerDetails.phoneNumber);
    if (!phoneNumber) return { ok: false, message: "Enter a valid South African mobile number." };
    const cart = await readCustomerCart(session.user.id);
    if (!cart.id || cart.items.length === 0) return { ok: false, message: "Your checkout list is empty." };
    const admin = createSupabaseAdminClient();
    if (!admin) return { ok: false, message: "Order service is unavailable." };
    const { data, error } = await admin.rpc("place_customer_order_v2", {
      p_cart_id: cart.id,
      p_customer_user_id: session.user.id,
      p_fulfillment_type: parsed.fulfillmentType,
      p_customer_details: {
        firstName: parsed.customerDetails.firstName,
        surname: parsed.customerDetails.surname,
        phoneNumber,
        addressLine: parsed.customerDetails.addressLine,
        suburb: parsed.customerDetails.suburb,
        city: parsed.customerDetails.city,
        province: parsed.customerDetails.province,
        postalCode: parsed.customerDetails.postalCode,
        deliveryInstructions: parsed.customerDetails.deliveryInstructions
      },
      p_payment_method: parsed.paymentMethod,
      p_idempotency_key: parsed.idempotencyKey
    });
    if (error) {
      const lower = error.message.toLowerCase();
      if (isMissingCheckoutSchemaError(error.code, lower)) {
        await logServerEvent("error", "customer_checkout_schema_unavailable", {
          code: error.code,
          message: error.message,
          cartId: cart.id,
          storeId: cart.storeId,
        });
        return { ok: false, message: "Online orders are temporarily unavailable. Please try again shortly." };
      }
      if (isCartValidationError(lower)) {
        await logServerEvent("warn", "customer_checkout_cart_validation_failed", {
          code: error.code,
          message: error.message,
          cartId: cart.id,
          storeId: cart.storeId,
          itemCount: cart.items.length
        });
        return { ok: false, message: "Your cart changed. Review the available products and try again." };
      }
      if (lower.includes("minimum")) return { ok: false, message: "Your order does not meet this store's minimum." };
      if (lower.includes("delivery") || lower.includes("collection")) return { ok: false, message: error.message };
      return { ok: false, message: "We could not place your order." };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (parsed.fulfillmentType === "delivery" && parsed.customerDetails.saveAddress && SOUTH_AFRICAN_PROVINCES.includes(parsed.customerDetails.province as typeof SOUTH_AFRICAN_PROVINCES[number])) {
      const { count } = await admin.from("customer_addresses").select("id", { count: "exact", head: true }).eq("user_id", session.user.id);
      await admin.from("customer_addresses").insert({
        user_id: session.user.id,
        label: "Delivery",
        street_address: parsed.customerDetails.addressLine,
        suburb: parsed.customerDetails.suburb,
        city: parsed.customerDetails.city,
        province: parsed.customerDetails.province,
        postal_code: parsed.customerDetails.postalCode,
        country: "South Africa",
        is_default: !count
      });
    }
    revalidatePath("/customer", "layout");
    revalidatePath("/customer/orders");
    revalidatePath("/dashboard/manager");
    revalidatePath("/dashboard/manager/orders");
    return { ok: true, message: `Order placed for ${parsed.fulfillmentType}.`, orderId: row?.order_id, orderNumber: row?.order_number };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, message: "Check your checkout details and try again." };
    return { ok: false, message: error instanceof Error ? error.message : "We could not place your order." };
  }
}

export async function cancelCustomerOrderAction(input: unknown) {
  try {
    await verifyOrigin();
    const session = await requireCustomerSession();
    const parsed = z.object({ orderId: z.string().uuid(), reason: z.string().trim().max(500).optional() }).strict().parse(input);
    const admin = createSupabaseAdminClient();
    if (!admin) return { ok: false, message: "Order service is unavailable." };
    const { error } = await admin.rpc("cancel_customer_order", {
      p_order_id: parsed.orderId,
      p_customer_user_id: session.user.id,
      p_reason: parsed.reason || null
    });
    if (error) return { ok: false, message: error.message.includes("no longer") ? error.message : "We could not cancel this order." };
    revalidatePath("/customer/orders");
    revalidatePath(`/customer/orders/${parsed.orderId}`);
    revalidatePath("/dashboard/manager/orders");
    return { ok: true, message: "Order cancelled and reserved stock released." };
  } catch {
    return { ok: false, message: "We could not cancel this order." };
  }
}

export async function logoutCustomerAction() {
  await verifyOrigin();
  const supabase = await createSupabaseServerClient();
  await supabase?.auth.signOut();
  redirect("/login");
}

export async function updateCustomerPersonalAction(formData: FormData) {
  await verifyOrigin();
  const session = await requireCustomerSession();
  const parsed = z.object({ firstName: z.string().min(1).max(80), surname: z.string().min(1).max(80), phoneNumber: z.string().min(10).max(20) }).safeParse({ firstName: value(formData, "firstName"), surname: value(formData, "surname"), phoneNumber: value(formData, "phoneNumber") });
  if (!parsed.success) throw new Error("Check your personal information.");
  const phoneNumber = normalizeSouthAfricanPhone(parsed.data.phoneNumber);
  if (!phoneNumber) throw new Error("Enter a valid South African mobile number.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.from("customer_profiles").update({ first_name: parsed.data.firstName, surname: parsed.data.surname, phone_number: phoneNumber }).eq("user_id", session.user.id);
  if (error) throw new Error("We could not update your personal information.");
  revalidatePath("/customer/profile");
  revalidatePath("/customer/profile/personal");
}

export async function addCustomerAddressAction(formData: FormData) {
  await verifyOrigin();
  const session = await requireCustomerSession();
  const parsed = customerAddressSchema.safeParse(addressFormValues(formData));
  if (!parsed.success) throw new Error("Check the address information.");
  const supabase = await createSupabaseServerClient();
  const { count, error: countError } = await supabase!.from("customer_addresses").select("id", { count: "exact", head: true }).eq("user_id", session.user.id);
  if (countError) throw new Error("We could not read your addresses.");
  const { error } = await supabase!.from("customer_addresses").insert({ ...addressRecord(parsed.data), user_id: session.user.id, is_default: count === 0 });
  if (error) throw new Error("We could not save this address.");
  revalidatePath("/customer/profile/addresses");
  revalidatePath("/customer/addresses");
  revalidatePath("/customer/checkout");
}

export async function updateCustomerPreferencesAction(formData: FormData) {
  await verifyOrigin();
  const session = await requireCustomerSession();
  const scope = value(formData, "preferenceScope");
  const favouriteCategories = formData.getAll("favouriteCategories").filter((item): item is string => typeof item === "string").slice(0, 20);
  const payload: Record<string, unknown> = { user_id: session.user.id };
  if (scope === "notifications") {
    payload.email_notifications = formData.get("emailNotifications") === "on";
    payload.sms_notifications = formData.get("smsNotifications") === "on";
    payload.promotional_notifications = formData.get("promotionalNotifications") === "on";
  } else if (scope === "categories") {
    payload.favourite_categories = favouriteCategories;
  } else if (scope === "filters") {
    const defaultRadius = Number(value(formData, "defaultRadius") || 15);
    payload.default_radius_km = Number.isInteger(defaultRadius) && defaultRadius >= 1 && defaultRadius <= 100 ? defaultRadius : 15;
    payload.open_now_only = formData.get("openNowOnly") === "on";
  } else if (scope === "appearance") {
    const appearance = value(formData, "appearance");
    payload.appearance = ["light", "dark", "system"].includes(appearance) ? appearance : "system";
  } else if (scope === "language") {
    payload.language = value(formData, "language") === "en-ZA" ? "en-ZA" : "en-ZA";
  } else {
    throw new Error("Invalid preference update.");
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.from("customer_preferences").upsert(payload, { onConflict: "user_id" });
  if (error) throw new Error("We could not update your preferences.");
  revalidatePath("/customer/profile");
  revalidatePath("/customer/profile/[section]", "page");
}

export async function submitCustomerSupportAction(formData: FormData) {
  await verifyOrigin();
  const session = await requireCustomerSession();
  const parsed = z.object({ category: z.enum(["account", "technical", "store", "privacy", "other"]), subject: z.string().min(3).max(120), message: z.string().min(10).max(2000) }).safeParse({ category: value(formData, "category"), subject: value(formData, "subject"), message: value(formData, "message") });
  if (!parsed.success) throw new Error("Complete all support fields.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.from("customer_support_requests").insert({ user_id: session.user.id, ...parsed.data });
  if (error) throw new Error("We could not submit your support request.");
  revalidatePath("/customer/profile/support");
}
