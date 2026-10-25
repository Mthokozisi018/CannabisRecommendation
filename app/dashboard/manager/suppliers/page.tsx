import { SupplierManagement } from "@/components/manager/SupplierManagement";
import { requireCompletedManagerDashboardSession } from "@/lib/manager/onboarding";
import { getManagerSupplyReport } from "@/lib/manager/supply-report";
import { getManagerSupplyContext } from "@/lib/manager/supply-requests";

export const dynamic = "force-dynamic";

export default async function SupplierInformationPage() {
  const [session, data, supplyContext] = await Promise.all([
    requireCompletedManagerDashboardSession(),
    getManagerSupplyReport(),
    getManagerSupplyContext()
  ]);
  return <SupplierManagement storeName={session.storeName} managerName={session.displayName} initialReport={data} canRequestSupply={Boolean(supplyContext)} />;
}
