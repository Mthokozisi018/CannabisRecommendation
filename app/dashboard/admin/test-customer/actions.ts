"use server";

import { revalidatePath } from "next/cache";
import { ensureTestCustomer, resetTestCustomer, type TestCustomerActionState } from "@/lib/admin/test-customer";
import { reportServerException } from "@/lib/logger";
import { assertRateLimit, verifyOrigin } from "@/lib/security";
import { requireAdminUser } from "@/lib/admin/data";

function message(error: unknown) {
  return error instanceof Error ? error.message : "Unable to complete the test customer action.";
}

export async function ensureTestCustomerAction(): Promise<TestCustomerActionState> {
  try {
    await verifyOrigin();
    const admin = await requireAdminUser();
    await assertRateLimit(`admin:test-customer:ensure:${admin.id}`, 6, 60 * 60_000);
    const result = await ensureTestCustomer();
    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/admin/test-customer");
    return { ok: true, message: `Test customer is ready: ${result.email}` };
  } catch (error) {
    await reportServerException("admin_test_customer_ensure_failed", error);
    return { ok: false, message: message(error) };
  }
}

export async function resetTestCustomerAction(): Promise<TestCustomerActionState> {
  try {
    await verifyOrigin();
    const admin = await requireAdminUser();
    await assertRateLimit(`admin:test-customer:reset:${admin.id}`, 12, 60 * 60_000);
    const result = await resetTestCustomer();
    revalidatePath("/dashboard/admin/test-customer");
    revalidatePath("/customer");
    revalidatePath("/customer/saved");
    revalidatePath("/customer/checkout");
    return { ok: true, message: `Test customer state was reset for ${result.email}.` };
  } catch (error) {
    await reportServerException("admin_test_customer_reset_failed", error);
    return { ok: false, message: message(error) };
  }
}
