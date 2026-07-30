import { CombinedAddStockForm } from "@/components/manager/forms/CombinedAddStockForm";
import { listManagerProducts } from "@/lib/manager/data";
import { requireCompletedManagerDashboardSession } from "@/lib/manager/onboarding";

export const dynamic = "force-dynamic";

export default async function ManageInventoryPage() {
  const [session, products] = await Promise.all([
    requireCompletedManagerDashboardSession(),
    listManagerProducts()
  ]);

  return (
    <main className="px-3 py-3 sm:px-4">
      <CombinedAddStockForm products={products} backHref="/dashboard/manager" storeName={session.storeName} managerName={session.displayName} />
    </main>
  );
}
