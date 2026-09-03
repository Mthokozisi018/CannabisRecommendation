import { ManagerSalesOverviewUI } from "@/components/manager/ManagerSalesOverviewUI";
import { defaultSalesReportFilters, getManagerSalesReport } from "@/lib/manager/sales-overview";
import { requireCompletedManagerDashboardSession } from "@/lib/manager/onboarding";

export const dynamic = "force-dynamic";

export default async function ManagerSalesPage() {
  const session = await requireCompletedManagerDashboardSession();
  const report = await getManagerSalesReport(session, defaultSalesReportFilters());
  return <ManagerSalesOverviewUI initialReport={report} storeName={session.storeName} managerName={session.displayName} />;
}
