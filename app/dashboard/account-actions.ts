"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { decideDashboardAccess, getDashboardSession, type DashboardSession } from "@/lib/dashboard-session";
import { managerPasswordIssues } from "@/lib/manager/password-policy";
import { normalizeSAPhone } from "@/lib/manager/onboarding";
import { southAfricanPhoneRegex, southAfricanProvinces } from "@/lib/manager/onboarding-options";
import { normalizeStoreImage, storeImageObjectPath } from "@/lib/product-image-upload";
import { assertRateLimit, verifyOrigin } from "@/lib/security";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export type AccountActionState = { ok: boolean; message: string };

const initialError = "Unable to update your account. Please try again.";
const storeImageBucket = "store-images";

const profileSchema = z.object({
  firstName: z.string().trim().min(2, "First name must be at least 2 characters.").max(100),
  surname: z.string().trim().min(2, "Surname must be at least 2 characters.").max(100),
  phoneNumber: z.string().trim().refine((value) => southAfricanPhoneRegex.test(value.replace(/\s/g, "")), "Enter a valid South African phone number."),
  alternativePhone: z.string().trim().optional(),
  physicalAddress: z.string().trim().min(5, "Address must be at least 5 characters.").max(240),
  city: z.string().trim().min(2, "City must be at least 2 characters.").max(120),
  province: z.enum(southAfricanProvinces),
  postalCode: z.string().trim().regex(/^[0-9]{4}$/, "Postal code must be 4 digits."),
  country: z.literal("South Africa", { errorMap: () => ({ message: "Country must be South Africa." }) })
}).superRefine((value, ctx) => {
  if (value.alternativePhone && !southAfricanPhoneRegex.test(value.alternativePhone.replace(/\s/g, ""))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["alternativePhone"], message: "Enter a valid South African alternative phone number." });
  }
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password.").max(256),
  newPassword: z.string().min(8).max(256),
  confirmPassword: z.string().min(8).max(256)
});

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function firstIssue(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? fallback;
  return error instanceof Error ? error.message : fallback;
}

function assertAccountRole(session: DashboardSession) {
  const decision = decideDashboardAccess(session.profile);
  if (!decision.allowed) throw new Error(decision.message);
  if (!session.isManager && !session.isReceptionist) throw new Error("Account panel is only available for managers and receptionists.");
  if (!session.assignedStoreId || session.storeAccessStatus !== "active") throw new Error("Your store access is not active.");
}

async function currentAccountSession() {
  const session = await getDashboardSession();
  if (!session) throw new Error("Sign in again to manage your account.");
  assertAccountRole(session);
  return session;
}

async function writeAccountAudit(session: DashboardSession, action: string, details: Record<string, unknown> = {}) {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin.from("audit_logs").insert({
    user_id: session.authUserId,
    action,
    table_name: "staff_profiles",
    record_id: session.staffProfileId,
    store_id: session.assignedStoreId,
    result: "success",
    details: {
      role: session.profile.role,
      staffProfileId: session.staffProfileId,
      ...details
    }
  });
}

export async function updateOwnAccountProfileAction(_prev: AccountActionState, formData: FormData): Promise<AccountActionState> {
  try {
    await verifyOrigin();
    const session = await currentAccountSession();
    await assertRateLimit(`account:profile-update:${session.authUserId}`, 12, 15 * 60_000);
    const admin = createSupabaseAdminClient();
    if (!admin) throw new Error("Supabase admin client is not configured.");

    const parsed = profileSchema.parse({
      firstName: text(formData, "firstName"),
      surname: text(formData, "surname"),
      phoneNumber: text(formData, "phoneNumber"),
      alternativePhone: text(formData, "alternativePhone") || undefined,
      physicalAddress: text(formData, "physicalAddress"),
      city: text(formData, "city"),
      province: text(formData, "province"),
      postalCode: text(formData, "postalCode"),
      country: text(formData, "country")
    });

    const changedFields = [
      ["first_name", session.profile.first_name, parsed.firstName],
      ["surname", session.profile.surname, parsed.surname],
      ["phone_number", session.profile.phone_number ?? session.profile.mobile_number, normalizeSAPhone(parsed.phoneNumber)],
      ["alternative_phone", session.profile.alternative_phone, parsed.alternativePhone ? normalizeSAPhone(parsed.alternativePhone) : null],
      ["physical_address", session.profile.physical_address, parsed.physicalAddress],
      ["city", session.profile.city, parsed.city],
      ["province", session.profile.province, parsed.province],
      ["postal_code", session.profile.postal_code, parsed.postalCode],
      ["country", session.profile.country, parsed.country]
    ].filter(([, previous, next]) => (previous ?? "") !== (next ?? "")).map(([field]) => field);

    const { data, error } = await admin
      .from("staff_profiles")
      .update({
        first_name: parsed.firstName,
        surname: parsed.surname,
        full_name: `${parsed.firstName} ${parsed.surname}`,
        mobile_number: normalizeSAPhone(parsed.phoneNumber),
        phone_number: normalizeSAPhone(parsed.phoneNumber),
        alternative_phone: parsed.alternativePhone ? normalizeSAPhone(parsed.alternativePhone) : null,
        physical_address: parsed.physicalAddress,
        city: parsed.city,
        province: parsed.province,
        postal_code: parsed.postalCode,
        country: parsed.country
      })
      .eq("id", session.staffProfileId)
      .eq("auth_user_id", session.authUserId)
      .eq("role", session.profile.role)
      .eq("store_id", session.assignedStoreId)
      .or("account_status.eq.active,and(account_status.is.null,is_active.eq.true)")
      .select("id")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data?.id) throw new Error("Your active account profile could not be found.");

    await writeAccountAudit(session, session.isManager ? "manager_updated_own_profile" : "receptionist_updated_own_profile", { changedFields });
    revalidatePath("/dashboard/account");
    revalidatePath("/dashboard/manager");
    revalidatePath("/dashboard/receptionist");
    return { ok: true, message: changedFields.length ? "Your account details were updated." : "No profile changes were needed." };
  } catch (error) {
    return { ok: false, message: firstIssue(error, initialError) };
  }
}

export async function changeOwnAccountPasswordAction(_prev: AccountActionState, formData: FormData): Promise<AccountActionState> {
  try {
    await verifyOrigin();
    const session = await currentAccountSession();
    await assertRateLimit(`account:password-change:${session.authUserId}`, 5, 15 * 60_000);
    const supabase = await createSupabaseServerClient();
    const admin = createSupabaseAdminClient();
    if (!supabase || !admin) throw new Error("Password changes are unavailable.");

    const parsed = passwordSchema.parse({
      currentPassword: text(formData, "currentPassword"),
      newPassword: text(formData, "newPassword"),
      confirmPassword: text(formData, "confirmPassword")
    });
    const passwordIssues = managerPasswordIssues(parsed.newPassword, parsed.confirmPassword);
    if (passwordIssues.length) throw new Error(passwordIssues[0]);

    const { data: verified, error: verifyError } = await supabase.auth.signInWithPassword({
      email: session.email,
      password: parsed.currentPassword
    });
    if (verifyError || verified.user?.id !== session.authUserId) throw new Error("Current password verification failed.");

    const { error: updateError } = await supabase.auth.updateUser({ password: parsed.newPassword });
    if (updateError) throw new Error("Password could not be changed.");

    const changedAt = new Date().toISOString();
    await admin
      .from("staff_profiles")
      .update({ password_changed_at: changedAt, temporary_password_active: false, temporary_password_fingerprint: null })
      .eq("id", session.staffProfileId)
      .eq("auth_user_id", session.authUserId)
      .eq("role", session.profile.role)
      .eq("store_id", session.assignedStoreId)
      .or("account_status.eq.active,and(account_status.is.null,is_active.eq.true)");
    await writeAccountAudit(session, session.isManager ? "manager_changed_own_password" : "receptionist_changed_own_password", { changedAt });
    return { ok: true, message: "Your password was changed successfully." };
  } catch (error) {
    return { ok: false, message: firstIssue(error, "Unable to change your password.") };
  }
}

export async function updateManagerStoreImageAction(_prev: AccountActionState, formData: FormData): Promise<AccountActionState> {
  let uploadedImagePath: string | null = null;
  try {
    await verifyOrigin();
    const session = await currentAccountSession();
    if (!session.isManager || !session.assignedStoreId) throw new Error("Only the manager for this store can change the store image.");
    await assertRateLimit(`account:store-image:${session.authUserId}`, 8, 15 * 60_000);
    const admin = createSupabaseAdminClient();
    if (!admin) throw new Error("Store image uploads are unavailable.");

    const imageFile = formData.get("storeImage");
    if (!(imageFile instanceof File) || imageFile.size <= 0) throw new Error("Choose a storefront image to upload.");

    const image = await normalizeStoreImage(imageFile);
    uploadedImagePath = storeImageObjectPath(session.assignedStoreId);
    const { error: uploadError } = await admin.storage.from(storeImageBucket).upload(uploadedImagePath, image.data, {
      contentType: image.contentType,
      cacheControl: "31536000",
      upsert: false
    });
    if (uploadError) throw new Error("Store image could not be uploaded.");
    const { data: publicUrl } = admin.storage.from(storeImageBucket).getPublicUrl(uploadedImagePath);
    if (!publicUrl.publicUrl) throw new Error("Store image URL could not be created.");

    const currentStore = await admin.from("stores")
      .select("id,store_image_path")
      .eq("id", session.assignedStoreId)
      .maybeSingle<{ id: string; store_image_path: string | null }>();
    if (currentStore.error || currentStore.data?.id !== session.assignedStoreId) throw new Error("Your store could not be checked.");

    const payload = {
      store_id: session.assignedStoreId,
      media_type: "cover",
      public_url: publicUrl.publicUrl,
      alt_text: `${session.storeName} storefront`,
      sort_order: 0,
      storage_bucket: storeImageBucket,
      storage_path: uploadedImagePath
    };

    const storeWrite = await admin.from("stores")
      .update({
        store_image_bucket: storeImageBucket,
        store_image_path: uploadedImagePath,
        store_image_url: publicUrl.publicUrl
      })
      .eq("id", session.assignedStoreId)
      .select("id")
      .maybeSingle();
    if (storeWrite.error || storeWrite.data?.id !== session.assignedStoreId) throw new Error("Store image could not be saved.");

    const currentMedia = await admin.from("store_media")
      .select("id")
      .eq("store_id", session.assignedStoreId)
      .eq("media_type", "cover")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (!currentMedia.error) {
      const write = currentMedia.data?.id
        ? await admin.from("store_media").update(payload).eq("id", currentMedia.data.id).eq("store_id", session.assignedStoreId).select("id").maybeSingle()
        : await admin.from("store_media").insert(payload).select("id").maybeSingle();
      if (write.error) throw new Error("Store image media could not be saved.");
    }

    if (currentStore.data?.store_image_path && currentStore.data.store_image_path !== uploadedImagePath) {
      await admin.storage.from(storeImageBucket).remove([currentStore.data.store_image_path]);
    }
    await writeAccountAudit(session, "manager_updated_store_image", { storeId: session.assignedStoreId });
    revalidatePath("/dashboard/account");
    revalidatePath("/customer");
    revalidatePath("/customer/stores");
    revalidatePath(`/customer/stores/${session.assignedStoreId}`);
    return { ok: true, message: "Store image updated. Customers will now see it instead of the placeholder." };
  } catch (error) {
    const admin = createSupabaseAdminClient();
    if (admin && uploadedImagePath) await admin.storage.from(storeImageBucket).remove([uploadedImagePath]);
    return { ok: false, message: firstIssue(error, "Unable to update the store image.") };
  }
}

export async function logoutOwnAccountAction() {
  await verifyOrigin();
  const supabase = await createSupabaseServerClient();
  const session = await getDashboardSession();
  if (session) {
    await writeAccountAudit(session, session.isManager ? "manager_logged_out" : "receptionist_logged_out");
  }
  await supabase?.auth.signOut();
  const store = await cookies();
  store.delete("greenchoice_staff");
  store.delete("sessionid");
  store.delete("csrftoken");
  redirect("/login");
}
