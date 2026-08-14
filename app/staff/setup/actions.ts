"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { invalidateManagerStaffCache } from "@/lib/cache/redis";
import { requireDashboardRoleSession } from "@/lib/dashboard-session";
import { LEGAL_DOCUMENTS, assertLegalDocumentsAvailable } from "@/lib/manager/legal-documents";
import { normalizeSAPhone } from "@/lib/manager/onboarding";
import { southAfricanPhoneRegex } from "@/lib/manager/onboarding-options";
import { managerPasswordIssues } from "@/lib/manager/password-policy";
import { reportServerException } from "@/lib/logger";
import { assertRateLimit, verifyOrigin } from "@/lib/security";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ReceptionistSetupValues = {
  firstName: string;
  surname: string;
  phoneNumber: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
};

export type ReceptionistSetupState = {
  ok: boolean;
  message: string;
  values?: ReceptionistSetupValues;
  revision?: string;
};

const schema = z.object({
  firstName: z.string().trim().min(2, "First name must be at least 2 characters.").max(100),
  surname: z.string().trim().min(2, "Surname must be at least 2 characters.").max(100),
  phoneNumber: z.string().trim().refine((value) => southAfricanPhoneRegex.test(value.replace(/\s/g, "")), "Enter a valid South African phone number."),
  password: z.string().min(12).max(256),
  confirmPassword: z.string().min(12).max(256),
  termsAccepted: z.literal(true, { errorMap: () => ({ message: "Accept the Terms of Service to continue." }) }),
  privacyAccepted: z.literal(true, { errorMap: () => ({ message: "Accept the Privacy Policy to continue." }) })
});

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function submittedValues(formData: FormData): ReceptionistSetupValues {
  return {
    firstName: text(formData, "firstName"),
    surname: text(formData, "surname"),
    phoneNumber: text(formData, "phoneNumber"),
    termsAccepted: formData.get("termsAccepted") === "on",
    privacyAccepted: formData.get("privacyAccepted") === "on"
  };
}

function actionMessage(error: unknown) {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Check your account details.";
  return error instanceof Error ? error.message : "Unable to complete receptionist account setup.";
}

export async function completeReceptionistAccountSetupAction(
  _previous: ReceptionistSetupState,
  formData: FormData
): Promise<ReceptionistSetupState> {
  const values = submittedValues(formData);
  let userId: string | null = null;
  try {
    await verifyOrigin();
    assertLegalDocumentsAvailable();
    const session = await requireDashboardRoleSession(["employee_receptionist"]);
    userId = session.authUserId;
    await assertRateLimit(`receptionist:account-setup:${session.authUserId}`, 10, 15 * 60_000);

    const parsed = schema.parse({
      ...values,
      password: text(formData, "password"),
      confirmPassword: text(formData, "confirmPassword")
    });
    const passwordIssues = managerPasswordIssues(parsed.password, parsed.confirmPassword);
    if (passwordIssues.length) throw new Error(passwordIssues[0]);

    const supabase = await createSupabaseServerClient();
    if (!supabase) throw new Error("Account setup is temporarily unavailable.");
    const { error: passwordError } = await supabase.auth.updateUser({ password: parsed.password });
    if (passwordError) {
      const sessionProblem = /session|expired|reauth|nonce|jwt|authentication/i.test(passwordError.message);
      throw new Error(sessionProblem
        ? "Your secure sign-in session has expired. Sign in again with your current password, then complete account setup."
        : "Your permanent password could not be saved. Check the requirements and try again.");
    }

    const { error: completionError } = await supabase.rpc("complete_manager_created_receptionist_setup", {
      p_first_name: parsed.firstName,
      p_surname: parsed.surname,
      p_mobile_number: normalizeSAPhone(parsed.phoneNumber),
      p_terms_version: LEGAL_DOCUMENTS.terms.version,
      p_privacy_policy_version: LEGAL_DOCUMENTS.privacy.version
    });
    if (completionError) {
      throw new Error("Your password was updated, but the profile could not be completed. Sign in with the new password and submit this form again.");
    }
    if (session.assignedStoreId) await invalidateManagerStaffCache(session.assignedStoreId);
  } catch (error) {
    if (error instanceof Error && /temporarily unavailable|profile could not be completed/i.test(error.message)) {
      await reportServerException("receptionist_account_setup_failed", error, { authUserId: userId });
    }
    return { ok: false, message: actionMessage(error), values, revision: crypto.randomUUID() };
  }
  redirect("/dashboard/receptionist" as never);
}
