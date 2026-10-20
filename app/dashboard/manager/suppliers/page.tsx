import { SupplierManagement } from "@/components/manager/SupplierManagement";
import { requireCompletedManagerDashboardSession } from "@/lib/manager/onboarding";
import { getManagerSupplyReport } from "@/lib/manager/supply-report";

export const dynamic = "force-dynamic";

export default async function SupplierInformationPage() {
  const [session, data] = await Promise.all([
    requireCompletedManagerDashboardSession(),
    getManagerSupplyReport()
  ]);
  return <SupplierManagement storeName={session.storeName} managerName={session.displayName} initialReport={data} />;
}
