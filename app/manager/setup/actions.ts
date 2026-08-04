"use server";

import { redirect } from "next/navigation";
import { LEGAL_DOCUMENTS, assertLegalDocumentsAvailable } from "@/lib/manager/legal-documents";
import { managerPasswordIssues } from "@/lib/manager/password-policy";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { assertRateLimit, verifyOrigin } from "@/lib/security";
import { accountSetupComplete, getCurrentManagerSetupProfile, linkedManagerStore, managerAccountSetupSchema, managerOnboardingComplete, normalizeSAPhone, slugForStoreName, storeRegistrationSchema } from "@/lib/manager/onboarding";

export type SetupActionState = { ok: boolean; message: string };

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function checkbox(formData: FormData, key: string) {
  return formData.get(key) === "on" ? "on" : "";
}

function firstIssue(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues?: { message?: string }[] }).issues;
    return issues?.[0]?.message ?? fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

export async function completeManagerAccountSetupAction(_prev: SetupActionState, formData: FormData): Promise<SetupActionState> {
  try {
    await verifyOrigin();
    assertLegalDocumentsAvailable();
    const { user, profile } = await getCurrentManagerSetupProfile();
    await assertRateLimit(`manager:account-setup:${user.id}`, 10, 15 * 60_000);
    const admin = createSupabaseAdminClient();
    if (!admin) throw new Error("Supabase admin client is not configured.");
    const parsed = managerAccountSetupSchema.parse({
      fullName: text(formData, "fullName"),
      surname: text(formData, "surname"),
      phoneNumber: text(formData, "phoneNumber"),
      physicalAddress: text(formData, "physicalAddress"),
      city: text(formData, "city"),
      province: text(formData, "province"),
      postalCode: text(formData, "postalCode"),
      termsAccepted: checkbox(formData, "termsAccepted"),
      privacyAccepted: checkbox(formData, "privacyAccepted")
    });
    const mustChangePassword = profile.temporary_password_active === true;
    const currentTemporaryPassword = text(formData, "currentTemporaryPassword");
    const permanentPassword = text(formData, "permanentPassword");
    const confirmPermanentPassword = text(formData, "confirmPermanentPassword");
    if (mustChangePassword) {
      const passwordIssues = managerPasswordIssues(permanentPassword, confirmPermanentPassword);
      if (passwordIssues.length) throw new Error(passwordIssues[0]);
      if (!currentTemporaryPassword) throw new Error("Enter the temporary password used to sign in.");
      if (currentTemporaryPassword === permanentPassword) {
        throw new Error("Choose a new password that is different from your temporary password.");
      }
      const supabase = await createSupabaseServerClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      if (!user.email) throw new Error("Manager authentication is unavailable.");
      const { data: verification, error: verificationError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentTemporaryPassword
      });
      if (verificationError || verification.user?.id !== user.id) {
        throw new Error("The temporary password is incorrect.");
      }
      const { error: passwordError } = await supabase.auth.updateUser({ password: permanentPassword });
      if (passwordError) throw new Error("The permanent password could not be saved.");
    }

    const acceptedAt = new Date().toISOString();
    const profileUpdate = {
      full_name: parsed.fullName,
      first_name: parsed.fullName,
      surname: parsed.surname,
      physical_address: parsed.physicalAddress,
      city: parsed.city,
      province: parsed.province,
      postal_code: parsed.postalCode,
      mobile_number: normalizeSAPhone(parsed.phoneNumber),
      phone_number: normalizeSAPhone(parsed.phoneNumber),
      terms_accepted: true,
      terms_accepted_at: acceptedAt,
      privacy_policy_accepted_at: acceptedAt,
      terms_version: LEGAL_DOCUMENTS.terms.version,
      privacy_policy_version: LEGAL_DOCUMENTS.privacy.version,
      account_setup_complete: true,
      profile_setup_complete: true,
      user_id: user.id,
      auth_user_id: user.id
    };
    const completion = mustChangePassword
      ? await admin.rpc("complete_manual_manager_account_setup", {
          p_auth_user_id: user.id,
          p_full_name: parsed.fullName,
          p_surname: parsed.surname,
          p_mobile_number: normalizeSAPhone(parsed.phoneNumber),
          p_physical_address: parsed.physicalAddress,
          p_city: parsed.city,
          p_province: parsed.province,
          p_postal_code: parsed.postalCode,
          p_terms_version: LEGAL_DOCUMENTS.terms.version,
          p_privacy_policy_version: LEGAL_DOCUMENTS.privacy.version
        })
      : await admin.from("staff_profiles").update(profileUpdate).eq("id", profile.id).eq("role", "manager").select("id, store_id").single();
    const { data: updatedProfile, error } = completion;
    if (error) throw new Error(error.message);
    if (!updatedProfile) throw new Error("Manager profile could not be updated.");
  } catch (error) {
    return { ok: false, message: firstIssue(error, "Unable to save manager account setup.") };
  }
  redirect("/manager/setup/store" as never);
}

export async function completeStoreRegistrationAction(_prev: SetupActionState, formData: FormData): Promise<SetupActionState> {
  await verifyOrigin();
  const { user, profile } = await getCurrentManagerSetupProfile();
  await assertRateLimit(`manager:store-setup:${user.id}`, 10, 15 * 60_000);
  if (!accountSetupComplete(profile)) {
    redirect("/manager/setup/account" as never);
  }

  let restrictedStore = false;
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) throw new Error("Supabase is not configured.");
    const parsed = storeRegistrationSchema.parse({
      storeName: text(formData, "storeName"),
      storePhoneNumber: text(formData, "storePhoneNumber"),
      physicalStoreAddress: text(formData, "physicalStoreAddress"),
      city: text(formData, "city"),
      province: text(formData, "province"),
      postalCode: text(formData, "postalCode"),
      informationAccurate: checkbox(formData, "informationAccurate")
    });

    const existingStore = linkedManagerStore(profile);
    if (profile.store_id && !existingStore?.id) {
      throw new Error("Your manager profile is linked to a store that no longer exists. Contact an administrator before continuing.");
    }

    const { data, error } = await supabase.rpc("complete_manager_store_registration", {
      p_store_name: parsed.storeName,
      p_store_phone_number: normalizeSAPhone(parsed.storePhoneNumber),
      p_physical_store_address: parsed.physicalStoreAddress,
      p_city: parsed.city,
      p_province: parsed.province,
      p_postal_code: parsed.postalCode,
      p_slug: slugForStoreName(parsed.storeName)
    });
    if (error) throw new Error("Store registration could not be completed.");
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.store_id) throw new Error("Store registration could not be completed.");
    restrictedStore = row.store_access_status !== "active";
  } catch (error) {
    return { ok: false, message: firstIssue(error, "Unable to register store.") };
  }
  if (restrictedStore) redirect("/dashboard/restricted/manager" as never);
  redirect("/manager/setup/complete" as never);
}

export async function finishManagerOnboardingAction() {
  await verifyOrigin();
  const { user, profile } = await getCurrentManagerSetupProfile();
  await assertRateLimit(`manager:onboarding-finish:${user.id}`, 20, 15 * 60_000);
  if (!managerOnboardingComplete(profile)) {
    if (!accountSetupComplete(profile)) redirect("/manager/setup/account" as never);
    redirect("/manager/setup/store" as never);
  }

  if (!profile.onboarding_complete_seen_at) {
    const admin = createSupabaseAdminClient();
    if (!admin) redirect("/login?error=unavailable");
    const { error } = await admin
      .from("staff_profiles")
      .update({ onboarding_complete_seen_at: new Date().toISOString() })
      .eq("id", profile.id)
      .eq("role", "manager");
    if (error) throw new Error(error.message);
  }

  redirect("/dashboard/manager" as never);
}
