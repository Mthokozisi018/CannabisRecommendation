import { archiveAdminDemoProductAction, updateAdminDemoProductCardAction, updateAdminDemoProductPosVisibilityAction } from "@/app/dashboard/admin/demo-store/actions";
import { ManagerInventoryBrowser } from "@/components/manager/ManagerInventoryBrowser";
import { listAdminDemoManagerProducts, requireAdminDemoStoreContext } from "@/lib/admin/demo-store";

export const dynamic = "force-dynamic";

export default async function AdminDemoManagerInventoryPage() {
  const [{ store }, products] = await Promise.all([
    requireAdminDemoStoreContext(),
    listAdminDemoManagerProducts()
  ]);

  return (
    <ManagerInventoryBrowser
      products={products}
      updateAction={updateAdminDemoProductCardAction}
      visibilityAction={updateAdminDemoProductPosVisibilityAction}
      archiveAction={archiveAdminDemoProductAction}
      backHref="/dashboard/admin/demo-store/manager"
      storeName={store.name}
    />
  );
}
