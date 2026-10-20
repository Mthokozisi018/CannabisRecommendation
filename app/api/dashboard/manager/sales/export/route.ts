import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCompletedManagerDashboardSession } from "@/lib/manager/onboarding";
import { getManagerSalesReport } from "@/lib/manager/sales-overview";
import { buildManagerSalesReportPdf } from "@/lib/manager/sales-report-pdf";
import { assertRateLimit, verifyOrigin } from "@/lib/security";

export const dynamic = "force-dynamic";
const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; sandbox",
  "X-Content-Type-Options": "nosniff",
  Vary: "Cookie, Authorization"
};

export async function POST(request: Request) {
  try {
    await verifyOrigin();
    const session = await requireCompletedManagerDashboardSession();
    if (!session.isManager || !session.assignedStoreId) return NextResponse.json({ error: "Manager access required." }, { status: 403, headers: privateHeaders });
    await assertRateLimit(`manager:sales-export:${session.authUserId}`, 8, 60_000);
    const report = await getManagerSalesReport(session, await request.json(), { includeAll: true });
    const pdf = buildManagerSalesReportPdf({ report, storeName: session.storeName, generatedAt: new Date() });
    const filename = `greenchoice-sales-${report.filters.month}.pdf`;
    return new Response(pdf, {
      status: 200,
      headers: {
        ...privateHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  } catch (error) {
    const status = error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 500;
    return NextResponse.json({ error: status === 400 ? "Invalid report filters." : "The report could not be exported. Please try again." }, { status, headers: privateHeaders });
  }
}
