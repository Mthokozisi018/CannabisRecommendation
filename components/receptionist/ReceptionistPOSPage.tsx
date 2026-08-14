import { ReceptionistPOS } from "@/components/receptionist/ReceptionistPOS";
import type { DashboardAccountProfile } from "@/components/account/account-types";
import { getCurrentStaff } from "@/lib/dal/auth";
import { getDashboardSession, type DashboardSession } from "@/lib/dashboard-session";
import { listReceptionistCatalog } from "@/lib/receptionist/products";

function accountProfileFromSession(session: DashboardSession): DashboardAccountProfile {
  return {
    firstName: session.profile.first_name ?? session.displayName.split(/\s+/)[0] ?? "",
    surname: session.profile.surname ?? "",
    email: session.email,
    phoneNumber: session.profile.phone_number ?? session.profile.mobile_number ?? "",
    alternativePhone: session.profile.alternative_phone ?? "",
    physicalAddress: session.profile.physical_address ?? "",
    city: session.profile.city ?? "",
    province: session.profile.province ?? "",
    postalCode: session.profile.postal_code ?? "",
    country: session.profile.country ?? "South Africa",
    employeeId: session.profile.employee_id ?? ""
  };
}

export async function ReceptionistPOSPage({ category }: { category?: string }) {
  const [catalog, staff, session] = await Promise.all([listReceptionistCatalog(), getCurrentStaff(), getDashboardSession()]);
  const profileLabel = staff?.role === "manager" ? "Manager" : "Receptionist";
  const backToDashboardHref = staff?.role === "manager" ? "/dashboard/manager" : undefined;

  return (
    <ReceptionistPOS
      products={catalog.products}
      categories={catalog.categories}
      unavailableReason={catalog.unavailableReason}
      initialCategory={category}
      profileLabel={profileLabel}
      accountRole={session?.isManager ? "manager" : "receptionist"}
      accountProfile={session ? accountProfileFromSession(session) : undefined}
      backToDashboardHref={backToDashboardHref}
    />
  );
}
