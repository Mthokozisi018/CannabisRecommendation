"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { assertRateLimit, verifyOrigin } from "@/lib/security";
import {
  cleanupUnboundFranchiseAuthAccount,
  createFranchiseAuthAccount,
  franchiseMutation,
  verifyFranchiseSensitiveAction,
} from "@/lib/franchise/mutations";
import {
  formValues,
  franchiseSchema,
  staffCreateSchema,
} from "@/lib/franchise/validation";
import type { FranchiseActionState } from "@/lib/franchise/types";
import { normalizeSAPhone } from "@/lib/manager/onboarding";

export async function registerFranchiseAction(
  _previous: FranchiseActionState,
  form: FormData,
): Promise<FranchiseActionState> {
  try {
    await verifyOrigin();
    const session = await requireAdmin();
    await assertRateLimit(
      `admin:franchise:${session.authUserId}`,
      10,
      60 * 60_000,
    );
    const data = franchiseSchema.parse(formValues(form));
    const id = await franchiseMutation(session.authUserId, "create_franchise", {
      ...data,
      phone: normalizeSAPhone(data.phone),
    });
    revalidatePath("/dashboard/admin/franchises");
    return {
      ok: true,
      id,
      message: "Franchise registered. Create its administrator next.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof z.ZodError
          ? error.issues[0].message
          : error instanceof Error
            ? error.message
            : "Registration failed.",
    };
  }
}
export async function registerFranchiseAdminAction(
  _previous: FranchiseActionState,
  form: FormData,
): Promise<FranchiseActionState> {
  let authId: string | undefined;
  try {
    await verifyOrigin();
    const session = await requireAdmin();
    const input = formValues(form);
    await verifyFranchiseSensitiveAction(session, input.actorPassword);
    const data = staffCreateSchema.parse(input);
    const franchiseId = z.string().uuid().parse(input.franchiseId);
    authId = await createFranchiseAuthAccount(
      session.authUserId,
      "franchise_admin",
      data,
      { franchiseId },
    );
    await franchiseMutation(session.authUserId, "create_fa", {
      franchiseId,
      authUserId: authId,
      firstName: data.firstName,
      surname: data.surname,
      phone: normalizeSAPhone(data.phone),
    });
    revalidatePath("/dashboard/admin/franchises");
    return {
      ok: true,
      message:
        "Franchise Administrator created. Share the email and temporary password securely. A permanent password is required at first login.",
    };
  } catch (error) {
    if (authId) await cleanupUnboundFranchiseAuthAccount(authId);
    return {
      ok: false,
      message:
        error instanceof z.ZodError
          ? error.issues[0].message
          : error instanceof Error
            ? error.message
            : "Account creation failed.",
    };
  }
}
