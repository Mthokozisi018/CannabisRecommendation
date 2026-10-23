import { ManagerPendingOrdersUI } from "@/components/manager/ManagerPendingOrdersUI";
import { listManagerPendingOrders } from "@/lib/manager/pending-orders";
import { requireCompletedManagerDashboardSession } from "@/lib/manager/onboarding";
import { pendingOrdersUiEnabled } from "@/lib/manager/pending-orders-availability";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pending Orders | GreenChoice Manager" };

export default async function ManagerPendingOrdersPage() {
  if (!pendingOrdersUiEnabled()) redirect("/dashboard/manager");
  const session = await requireCompletedManagerDashboardSession();
  const orders = await listManagerPendingOrders(session);
  return <ManagerPendingOrdersUI initialOrders={orders} storeName={session.storeName} />;
}
