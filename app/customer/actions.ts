"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCustomerSession } from "@/lib/customer/auth";
import { normalizeSouthAfricanPhone, SOUTH_AFRICAN_PROVINCES } from "@/lib/customer/validation";
import { verifyOrigin } from "@/lib/security";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function value(form: FormData, key: string) { const entry = form.get(key); return typeof entry === "string" ? entry.trim() : ""; }

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
  const parsed = z.object({ label: z.string().min(1).max(40), streetAddress: z.string().min(3).max(180), unitDetails: z.string().max(100), suburb: z.string().min(1).max(100), city: z.string().min(1).max(100), province: z.enum(SOUTH_AFRICAN_PROVINCES), postalCode: z.string().regex(/^\d{4}$/) }).safeParse({ label: value(formData, "label"), streetAddress: value(formData, "streetAddress"), unitDetails: value(formData, "unitDetails"), suburb: value(formData, "suburb"), city: value(formData, "city"), province: value(formData, "province"), postalCode: value(formData, "postalCode") });
  if (!parsed.success) throw new Error("Check the address information.");
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase!.from("customer_addresses").select("id", { count: "exact", head: true }).eq("user_id", session.user.id);
  const { error } = await supabase!.from("customer_addresses").insert({ user_id: session.user.id, label: parsed.data.label, street_address: parsed.data.streetAddress, unit_details: parsed.data.unitDetails || null, suburb: parsed.data.suburb, city: parsed.data.city, province: parsed.data.province, postal_code: parsed.data.postalCode, country: "South Africa", is_default: !count });
  if (error) throw new Error("We could not save this address.");
  revalidatePath("/customer/profile/addresses");
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
