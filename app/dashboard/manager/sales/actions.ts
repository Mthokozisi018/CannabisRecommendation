"use server";

import { z } from "zod";
import { requireCompletedManagerDashboardSession } from "@/lib/manager/onboarding";
import { getManagerSalesReport, type ManagerSalesReport } from "@/lib/manager/sales-overview";
import { assertRateLimit, verifyOrigin } from "@/lib/security";
import { getManagerCustomerPurchaseOverview, type CustomerPurchaseOverview } from "@/lib/manager/customer-purchase-overview";

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

export type ManagerCustomerPurchaseActionResult =
  | { ok: true; overview: CustomerPurchaseOverview }
  | { ok: false; message: string };

export async function refreshManagerCustomerPurchaseOverview(input: unknown): Promise<ManagerCustomerPurchaseActionResult> {
  try {
    await verifyOrigin();
    const session = await requireCompletedManagerDashboardSession();
    if (!session.isManager || !session.assignedStoreId) throw new Error("Manager access required.");
    await assertRateLimit(`manager:customer-purchases:${session.authUserId}`, 60, 60_000);
    return { ok: true, overview: await getManagerCustomerPurchaseOverview(session, input) };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof z.ZodError ? "Check the selected report filters and try again." : "Customer purchases could not be loaded. Please try again."
    };
  }
}
