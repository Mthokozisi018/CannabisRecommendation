"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireFranchiseAdmin } from "@/lib/franchise/auth";
import { franchiseMutation } from "@/lib/franchise/mutations";
import type { FranchiseActionState } from "@/lib/franchise/types";
import { managerPasswordIssues } from "@/lib/manager/password-policy";
import {
  LEGAL_DOCUMENTS,
  assertLegalDocumentsAvailable,
} from "@/lib/manager/legal-documents";
import { assertRateLimit, verifyOrigin } from "@/lib/security";

export async function completeFranchiseSetupAction(
  _previous: FranchiseActionState,
  form: FormData,
): Promise<FranchiseActionState> {
  try {
    await verifyOrigin();
    assertLegalDocumentsAvailable();
    const { session, supabase } = await requireFranchiseAdmin(true);
    await assertRateLimit(
      `franchise:setup:${session.authUserId}`,
      10,
      15 * 60_000,
    );
    const password = z.string().max(256).parse(form.get("password"));
    const issues = managerPasswordIssues(
      password,
      String(form.get("confirmPassword") ?? ""),
    );
    if (issues.length) throw new Error(issues[0]);
    if (
      form.get("termsAccepted") !== "on" ||
      form.get("privacyAccepted") !== "on"
    )
      throw new Error("Accept the Terms of Service and Privacy Policy.");
    const { error } = await supabase.auth.updateUser({ password });
    if (error)
      throw new Error(
        "Your password could not be changed. Use a different strong password or sign in again and retry.",
      );
    try {
      await franchiseMutation(session.authUserId, "complete_setup", {
        termsVersion: LEGAL_DOCUMENTS.terms.version,
        privacyVersion: LEGAL_DOCUMENTS.privacy.version,
      });
    } catch {
      throw new Error(
        "Your password was changed, but setup could not be completed. Sign in with the new password and retry setup with another permanent password.",
      );
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Account setup failed.",
    };
  }
  redirect("/dashboard/franchise" as never);
}
