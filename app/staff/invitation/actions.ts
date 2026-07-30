"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { LEGAL_DOCUMENTS } from "@/lib/manager/legal-documents";
import { normalizeSAPhone } from "@/lib/manager/onboarding";
import { southAfricanPhoneRegex, southAfricanProvinces } from "@/lib/manager/onboarding-options";
import { managerPasswordIssues } from "@/lib/manager/password-policy";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertRateLimit, verifyOrigin } from "@/lib/security";

export type StaffOnboardingState = { ok: boolean; message: string };

const staffOnboardingSchema = z.object({
  invitationId: z.string().uuid(),
  firstName: z.string().trim().min(2, "First name must be at least 2 characters.").max(100),
  surname: z.string().trim().min(2, "Surname must be at least 2 characters.").max(100),
  phoneNumber: z.string().trim().refine((value) => southAfricanPhoneRegex.test(value.replace(/\s/g, "")), "Enter a valid South African phone number."),
  alternativePhone: z.string().trim().optional(),
  email: z.string().trim().toLowerCase().email("Invitation email is invalid."),
  streetAddress: z.string().trim().min(5, "Street address must be at least 5 characters.").max(240),
  city: z.string().trim().min(2, "City must be at least 2 characters.").max(120),
  province: z.enum(southAfricanProvinces),
  postalCode: z.string().trim().regex(/^[0-9]{4}$/, "Postal code must be 4 digits."),
  country: z.literal("South Africa", { errorMap: () => ({ message: "Country must be South Africa." }) }),
  employeeId: z.string().trim().max(80, "Employee ID must be 80 characters or fewer.").optional(),
  role: z.literal("Receptionist", { errorMap: () => ({ message: "Role must be Receptionist." }) }),
  password: z.string().min(8).max(256),
  confirmPassword: z.string().min(8).max(256),
  termsAccepted: z.literal("on", { errorMap: () => ({ message: "You must accept the Terms and Privacy Policy before continuing." }) })
}).superRefine((value, ctx) => {
  if (value.alternativePhone && !southAfricanPhoneRegex.test(value.alternativePhone.replace(/\s/g, ""))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["alternativePhone"], message: "Enter a valid South African alternative phone number." });
  }
});

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function checkbox(formData: FormData, key: string) {
  return formData.get(key) === "on" ? "on" : "";
}

function firstIssue(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? fallback;
  return fallback;
}

export async function completeStaffOnboardingAction(_prev: StaffOnboardingState, formData: FormData): Promise<StaffOnboardingState> {
  try {
    await verifyOrigin();
    const supabase = await createSupabaseServerClient();
    if (!supabase) throw new Error("Supabase is not configured.");
    const parsed = staffOnboardingSchema.parse({
      invitationId: text(formData, "invitationId"),
      firstName: text(formData, "firstName"),
      surname: text(formData, "surname"),
      phoneNumber: text(formData, "phoneNumber"),
      alternativePhone: text(formData, "alternativePhone") || undefined,
      email: text(formData, "email"),
      streetAddress: text(formData, "streetAddress"),
      city: text(formData, "city"),
      province: text(formData, "province"),
      postalCode: text(formData, "postalCode"),
      country: text(formData, "country"),
      employeeId: text(formData, "employeeId") || undefined,
      role: text(formData, "role"),
      password: text(formData, "password"),
      confirmPassword: text(formData, "confirmPassword"),
      termsAccepted: checkbox(formData, "termsAccepted")
    });
    const passwordIssues = managerPasswordIssues(parsed.password, parsed.confirmPassword);
    if (passwordIssues.length) return { ok: false, message: passwordIssues[0] };

    const { data: userData, error: userError } = await supabase.auth.getUser();
    const user = userData.user;
    const metadataInvitationId = user?.user_metadata?.staff_invitation_id;
    if (userError || !user?.email || metadataInvitationId !== parsed.invitationId) {
      throw new Error("Invitation session is unavailable.");
    }
    await assertRateLimit(`staff:onboarding:${user.id}`, 5, 15 * 60_000);

    const { data: invitation, error: invitationError } = await supabase
      .from("staff_invitations")
      .select("id, email, auth_user_id")
      .eq("id", parsed.invitationId)
      .maybeSingle();
    if (invitationError || !invitation ||
        invitation.auth_user_id !== user.id ||
        invitation.email.toLowerCase() !== user.email.toLowerCase() ||
        parsed.email !== user.email.toLowerCase()) {
      throw new Error("Invitation session is unavailable.");
    }

    const { error: passwordError } = await supabase.auth.updateUser({ password: parsed.password });
    if (passwordError) throw new Error("Password update failed.");

    const { error: completionError } = await supabase.rpc("complete_staff_onboarding", {
      p_invitation_id: parsed.invitationId,
      p_first_name: parsed.firstName,
      p_surname: parsed.surname,
      p_mobile_number: normalizeSAPhone(parsed.phoneNumber),
      p_alternative_phone: parsed.alternativePhone ? normalizeSAPhone(parsed.alternativePhone) : "",
      p_physical_address: parsed.streetAddress,
      p_city: parsed.city,
      p_province: parsed.province,
      p_postal_code: parsed.postalCode,
      p_country: parsed.country,
      p_employee_id: parsed.employeeId ?? "",
      p_terms_version: LEGAL_DOCUMENTS.terms.version,
      p_privacy_policy_version: LEGAL_DOCUMENTS.privacy.version
    });
    if (completionError) throw new Error("Invitation completion failed.");
  } catch (error) {
    return { ok: false, message: firstIssue(error, "Unable to complete onboarding. Open the latest invitation link and try again.") };
  }
  redirect("/staff/invitation/complete" as never);
}
