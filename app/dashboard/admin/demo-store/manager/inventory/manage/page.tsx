import { addAdminDemoInventoryStockAction, createAdminDemoProductAction } from "@/app/dashboard/admin/demo-store/actions";
import { CombinedAddStockForm } from "@/components/manager/forms/CombinedAddStockForm";
import { listAdminDemoManagerProducts, requireAdminDemoStoreContext } from "@/lib/admin/demo-store";

export const dynamic = "force-dynamic";

export default async function AdminDemoManageInventoryPage() {
  const [{ store }, products] = await Promise.all([
    requireAdminDemoStoreContext(),
    listAdminDemoManagerProducts()
  ]);

  return (
    <main className="px-3 py-3 sm:px-4">
      <CombinedAddStockForm
        products={products}
        createAction={createAdminDemoProductAction}
        addStockAction={addAdminDemoInventoryStockAction}
        backHref="/dashboard/admin/demo-store/manager"
        storeName={store.name}
        managerName="Administrator"
      />
    </main>
  );
}
