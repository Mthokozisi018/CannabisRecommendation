"use server";

import { z } from "zod";
import { requireCompletedManagerDashboardSession } from "@/lib/manager/onboarding";
import { getManagerSalesReport, type ManagerSalesReport } from "@/lib/manager/sales-overview";
import { assertRateLimit, verifyOrigin } from "@/lib/security";

export type ManagerSalesReportActionResult =
  | { ok: true; report: ManagerSalesReport }
  | { ok: false; message: string };

export async function refreshManagerSalesReport(input: unknown): Promise<ManagerSalesReportActionResult> {
  try {
    await verifyOrigin();
    const session = await requireCompletedManagerDashboardSession();
    if (!session.isManager || !session.assignedStoreId) throw new Error("Manager access required.");
    await assertRateLimit(`manager:sales-report:${session.authUserId}`, 40, 60_000);
    return { ok: true, report: await getManagerSalesReport(session, input) };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof z.ZodError ? "Check the selected report filters and try again." : "The sales report could not be loaded. Please try again."
    };
  }
}
