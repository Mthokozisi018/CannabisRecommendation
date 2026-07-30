import { ReceptionistPOS } from "@/components/receptionist/ReceptionistPOS";
import { getCurrentStaff } from "@/lib/dal/auth";
import { listReceptionistCatalog } from "@/lib/receptionist/products";

export async function ReceptionistPOSPage({ category }: { category?: string }) {
  const [catalog, staff] = await Promise.all([listReceptionistCatalog(), getCurrentStaff()]);
  const profileLabel = staff?.role === "manager" ? "Manager" : "Receptionist";
  const backToDashboardHref = staff?.role === "manager" ? "/dashboard/manager" : undefined;

  return (
    <ReceptionistPOS
      products={catalog.products}
      categories={catalog.categories}
      unavailableReason={catalog.unavailableReason}
      initialCategory={category}
      profileLabel={profileLabel}
      backToDashboardHref={backToDashboardHref}
    />
  );
}
