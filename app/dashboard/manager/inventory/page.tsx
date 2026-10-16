import { isReadOnlyDemo } from "@/lib/demo-access";
import { ManagerInventoryBrowser } from "@/components/manager/ManagerInventoryBrowser";
import { listManagerProducts } from "@/lib/manager/data";
import { requireCompletedManagerDashboardSession } from "@/lib/manager/onboarding";

export const dynamic = "force-dynamic";

export default async function ManagerInventoryPage() {
  const [session, products] = await Promise.all([
    requireCompletedManagerDashboardSession(),
    listManagerProducts()
  ]);

  return <ManagerInventoryBrowser readOnlyDemo={isReadOnlyDemo(session.user)} products={products} backHref="/dashboard/manager" storeName={session.storeName} />;
}
