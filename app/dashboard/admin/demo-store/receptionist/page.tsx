import { ReceptionistPOS } from "@/components/receptionist/ReceptionistPOS";
import { checkoutAdminDemoSaleAction } from "@/app/dashboard/admin/demo-store/actions";
import { DashboardBackdrop } from "@/components/GreenChoiceDashboard";
import { getOrCreateAdminDemoStore } from "@/lib/admin/demo-store";
import { listReceptionistCatalogForStore } from "@/lib/receptionist/products";

export const dynamic = "force-dynamic";

export default async function AdminDemoReceptionistDashboardPage() {
  const demoStore = await getOrCreateAdminDemoStore();
  const catalog = await listReceptionistCatalogForStore(demoStore.id);

  return (
    <>
      <DashboardBackdrop variant="receptionist" />
      <ReceptionistPOS
        products={catalog.products}
        categories={catalog.categories}
        unavailableReason={catalog.unavailableReason}
        profileLabel="Admin Demo"
        storeName={demoStore.name}
        backToDashboardHref="/dashboard/admin/demo-store/manager"
        isDemo
        checkoutAction={checkoutAdminDemoSaleAction}
      />
    </>
  );
}
