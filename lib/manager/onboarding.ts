import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { requireCompletedManagerDashboardSession as requireCompletedDashboardSession } from "@/lib/dashboard-session";
import { southAfricanPhoneRegex, southAfricanProvinces } from "@/lib/manager/onboarding-options";

export const managerAccountSetupSchema = z.object({
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters."),
  surname: z.string().trim().min(2, "Surname must be at least 2 characters."),
  phoneNumber: z.string().trim().refine((value) => southAfricanPhoneRegex.test(value.replace(/\s/g, "")), "Enter a valid South African phone number."),
  physicalAddress: z.string().trim().min(5, "Physical address must be at least 5 characters."),
  city: z.string().trim().min(2, "City or town must be at least 2 characters."),
  province: z.enum(southAfricanProvinces),
  postalCode: z.string().trim().regex(/^[0-9]{4}$/, "Postal code must be 4 digits."),
  termsAccepted: z.literal("on", { errorMap: () => ({ message: "You must accept the Terms of Service before continuing." }) }),
  privacyAccepted: z.literal("on", { errorMap: () => ({ message: "You must accept the Privacy Policy before continuing." }) })
});

export const storeRegistrationSchema = z.object({
  storeName: z.string().trim().min(2, "Store name must be at least 2 characters.").max(100, "Store name must be 100 characters or fewer."),
  storePhoneNumber: z.string().trim().refine((value) => southAfricanPhoneRegex.test(value.replace(/\s/g, "")), "Enter a valid South African store phone number."),
  physicalStoreAddress: z.string().trim().min(5, "Physical store address must be at least 5 characters."),
  city: z.string().trim().min(2, "City or town must be at least 2 characters."),
  province: z.enum(southAfricanProvinces),
  postalCode: z.string().trim().regex(/^[0-9]{4}$/, "Postal code must be 4 digits."),
  informationAccurate: z.literal("on", { errorMap: () => ({ message: "You must confirm that all store information provided is accurate before creating the store." }) })
});

export type ManagerSetupProfile = {
  id: string;
  auth_user_id: string;
  user_id: string | null;
  email: string;
  full_name: string | null;
  first_name: string | null;
  surname: string | null;
  physical_address: string | null;
  city: string | null;
  province: typeof southAfricanProvinces[number] | null;
  postal_code: string | null;
  mobile_number: string | null;
  phone_number: string | null;
  role: string;
  is_active: boolean | null;
  account_status: string | null;
  store_id: string | null;
  account_setup_complete: boolean | null;
  profile_setup_complete: boolean | null;
  store_setup_complete: boolean | null;
  onboarding_completed_at: string | null;
  onboarding_complete_seen_at: string | null;
  temporary_password_active: boolean | null;
  temporary_password_fingerprint: string | null;
  password_changed_at: string | null;
  terms_accepted_at: string | null;
  privacy_policy_accepted_at: string | null;
  terms_version: string | null;
  privacy_policy_version: string | null;
  stores: ManagerSetupStore | ManagerSetupStore[] | null;
};

export type ManagerSetupStore = {
  id: string;
  store_access_status: "active" | "restricted" | null;
  slug: string | null;
  name: string | null;
  address: string | null;
  store_address: string | null;
  store_contact_email: string | null;
  store_phone_number: string | null;
  physical_store_address: string | null;
  city: string | null;
  province: typeof southAfricanProvinces[number] | null;
  postal_code: string | null;
  business_registration_number: string | null;
  cannabis_license_or_permit_number: string | null;
  created_by_manager_id: string | null;
  store_information_confirmed_at: string | null;
  store_information_confirmed_by: string | null;
};

export type ManagerAccountInitialValues = {
  fullName: string;
  surname: string;
  physicalAddress: string;
  phoneNumber: string;
  city: string;
  province: string;
  postalCode: string;
};

export type StoreRegistrationInitialValues = {
  storeName: string;
  storePhoneNumber: string;
  physicalStoreAddress: string;
  city: string;
  province: string;
  postalCode: string;
};

function profileStore(profile: ManagerSetupProfile) {
  return Array.isArray(profile.stores) ? profile.stores[0] ?? null : profile.stores;
}

export function managerAccountInitialValues(): ManagerAccountInitialValues {
  return {
    fullName: "",
    surname: "",
    physicalAddress: "",
    phoneNumber: "",
    city: "",
    province: "",
    postalCode: ""
  };
}

export function storeRegistrationInitialValues(profile: ManagerSetupProfile): StoreRegistrationInitialValues {
  const store = profileStore(profile);
  return {
    storeName: store?.name ?? "",
    storePhoneNumber: store?.store_phone_number ?? "",
    physicalStoreAddress: store?.physical_store_address ?? store?.store_address ?? store?.address ?? "",
    city: store?.city ?? "",
    province: store?.province ?? "",
    postalCode: store?.postal_code ?? ""
  };
}

export function linkedManagerStore(profile: ManagerSetupProfile) {
  return profileStore(profile);
}

function accountIsActive(profile: ManagerSetupProfile) {
  return profile.account_status ? profile.account_status === "active" : profile.is_active === true;
}

export function normalizeSAPhone(value: string) {
  const compact = value.replace(/\s/g, "");
  if (compact.startsWith("+27")) return compact;
  if (compact.startsWith("27")) return `+${compact}`;
  if (compact.startsWith("0")) return `+27${compact.slice(1)}`;
  return compact;
}

export function slugForStoreName(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "store";
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

const getCurrentManagerSetupProfileCached = cache(async () => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?error=unavailable");
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) redirect("/login");

  const admin = createSupabaseAdminClient();
  if (!admin) redirect("/login?error=unavailable");

  const { data: profile, error } = await admin
    .from("staff_profiles")
    .select("id, auth_user_id, user_id, email, full_name, first_name, surname, physical_address, city, province, postal_code, mobile_number, phone_number, role, is_active, account_status, store_id, account_setup_complete, profile_setup_complete, store_setup_complete, onboarding_completed_at, onboarding_complete_seen_at, temporary_password_active, temporary_password_fingerprint, password_changed_at, terms_accepted_at, privacy_policy_accepted_at, terms_version, privacy_policy_version, stores(id, slug, name, store_access_status, address, store_address, store_contact_email, store_phone_number, physical_store_address, city, province, postal_code, business_registration_number, cannabis_license_or_permit_number, created_by_manager_id, store_information_confirmed_at, store_information_confirmed_by)")
    .eq("auth_user_id", user.id)
    .returns<ManagerSetupProfile[]>();
  if (error) throw new Error(error.message);
  const activeManagers = (profile ?? []).filter((item) => item.role === "manager" && accountIsActive(item));
  if (activeManagers.length > 1) {
    throw new Error("Multiple active manager staff profiles exist for this user. Contact an administrator before continuing setup.");
  }
  const managerProfile = activeManagers[0];
  if (!managerProfile) redirect("/denied");
  if (managerProfile.store_id && profileStore(managerProfile)?.store_access_status !== "active") {
    redirect("/dashboard/restricted/manager" as never);
  }
  return { user, profile: managerProfile };
});

export async function getCurrentManagerSetupProfile() {
  return getCurrentManagerSetupProfileCached();
}

export function accountSetupComplete(profile: ManagerSetupProfile) {
  if (profile.temporary_password_active === true) return false;
  const legalAccepted = Boolean(profile.terms_accepted_at && profile.privacy_policy_accepted_at && profile.terms_version && profile.privacy_policy_version);
  const baseComplete = profile.account_setup_complete === true || profile.profile_setup_complete === true;
  if (!legalAccepted || !baseComplete) return false;
  if (profile.onboarding_complete_seen_at) return true;
  return Boolean(profile.full_name && profile.surname && (profile.phone_number || profile.mobile_number) && profile.physical_address && profile.city && profile.province && profile.postal_code);
}

export function storeSetupComplete(profile: ManagerSetupProfile) {
  const storeConfirmation = profileStore(profile);
  return profile.store_setup_complete === true && Boolean(profile.store_id && storeConfirmation?.store_information_confirmed_at && storeConfirmation.store_information_confirmed_by);
}

export function managerOnboardingComplete(profile: ManagerSetupProfile) {
  return accountSetupComplete(profile) && storeSetupComplete(profile);
}

export async function requireManagerSetupStep(step: "account" | "store") {
  const context = await getCurrentManagerSetupProfile();
  const accountDone = accountSetupComplete(context.profile);
  const storeDone = storeSetupComplete(context.profile);

  if (accountDone && storeDone) {
    if (context.profile.onboarding_complete_seen_at) redirect("/dashboard/manager" as never);
    redirect("/manager/setup/complete" as never);
  }
  if (step === "account" && accountDone && !storeDone) redirect("/manager/setup/store" as never);
  if (step === "store" && !accountDone) redirect("/manager/setup/account" as never);
  return context;
}

export async function requireManagerOnboardingCompletePage() {
  const context = await getCurrentManagerSetupProfile();
  if (!accountSetupComplete(context.profile)) redirect("/manager/setup/account" as never);
  if (!storeSetupComplete(context.profile)) redirect("/manager/setup/store" as never);
  if (context.profile.onboarding_complete_seen_at) redirect("/dashboard/manager" as never);
  return context;
}

export async function requireCompletedManagerOnboarding() {
  const context = await getCurrentManagerSetupProfile();
  if (!accountSetupComplete(context.profile)) redirect("/manager/setup/account" as never);
  if (!storeSetupComplete(context.profile)) redirect("/manager/setup/store" as never);
  if (!context.profile.onboarding_complete_seen_at) redirect("/manager/setup/complete" as never);
  return context;
}

export async function requireCompletedManagerDashboardSession() {
  return requireCompletedDashboardSession();
}
