import { AddStockForm } from "@/components/manager/forms/AddStockForm";
import { listManagerProducts } from "@/lib/manager/data";
import { listAddStockSuppliers } from "@/lib/manager/add-stock-suppliers";
import { requireCompletedManagerDashboardSession } from "@/lib/manager/onboarding";

export const dynamic = "force-dynamic";

export default async function ManageInventoryPage() {
  const [session, products, suppliers] = await Promise.all([
    requireCompletedManagerDashboardSession(),
    listManagerProducts(),
    listAddStockSuppliers()
  ]);

  return (
    <main>
      <AddStockForm products={products} suppliers={suppliers} backHref="/dashboard/manager" storeName={session.storeName} managerName={session.displayName} />
    </main>
  );
}
