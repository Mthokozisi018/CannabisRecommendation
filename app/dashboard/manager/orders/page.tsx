import { ManagerPendingOrdersUI } from "@/components/manager/ManagerPendingOrdersUI";
import { listManagerPendingOrders } from "@/lib/manager/pending-orders";
import { requireCompletedManagerDashboardSession } from "@/lib/manager/onboarding";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pending Orders | GreenChoice Manager" };

export default async function ManagerPendingOrdersPage() {
  const session = await requireCompletedManagerDashboardSession();
  const orders = await listManagerPendingOrders(session);
  return <ManagerPendingOrdersUI initialOrders={orders} storeName={session.storeName} />;
}
