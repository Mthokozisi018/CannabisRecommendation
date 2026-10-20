import { Suspense } from "react";
import Link from "next/link";
import { StoreRegistrationQR } from "@/components/manager/StoreRegistrationQR";
import { DashboardAccountPanel } from "@/components/account/DashboardAccountMenu";
import type { DashboardAccountProfile } from "@/components/account/account-types";
import { ManagerDashboardActions } from "@/components/manager/ManagerDashboardActions";
import { ManagerPOSRoutePreloader } from "@/components/manager/ManagerPOSRoutePreloader";
import { ManagerWelcomePanel } from "@/components/manager/ManagerWelcomePanel";
import { getManagerDashboardSummary } from "@/lib/manager/dashboard-summary";
import type { DashboardSession } from "@/lib/dashboard-session";
import { requireCompletedManagerDashboardSession } from "@/lib/manager/onboarding";
import { warmReceptionistCatalogForStore } from "@/lib/receptionist/products";
import { countManagerPendingOrders } from "@/lib/manager/pending-orders";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function managerGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning,";
  if (hour < 18) return "Good afternoon,";
  return "Good evening,";
}

function firstName(displayName: string) {
  return displayName.trim().split(/\s+/)[0] || "Manager";
}

function roleLabel(role: string) {
  if (role === "manager") return "Store Manager";
  return role
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function accountProfileFromSession(session: DashboardSession): DashboardAccountProfile {
  return {
    firstName: session.profile.first_name ?? firstName(session.displayName),
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

export default async function ManagerDashboardPage() {
  const session = await requireCompletedManagerDashboardSession();
  const managerName = firstName(session.displayName || "Manager");
  const greeting = managerGreeting();
  const pendingOrderCount = await countManagerPendingOrders(session);
  const supabase = await createSupabaseServerClient();
  const franchiseStore = session.assignedStoreId && supabase
    ? await supabase.from("stores").select("franchise_id").eq("id", session.assignedStoreId).maybeSingle()
    : null;

  return (
    <main className="gc-manager-dashboard-page relative isolate flex min-h-screen items-start px-4 pb-8 pt-20 sm:px-6 sm:pt-10 lg:px-[clamp(2rem,8vw,8.5rem)] lg:pt-[clamp(3rem,10vh,7rem)]">
      <div className="absolute right-4 top-4 z-30 flex items-center gap-3 sm:right-6 sm:top-6">
        <StoreRegistrationQR />
        <DashboardAccountPanel role="manager" profile={accountProfileFromSession(session)} />
      </div>
      <section className="gc-manager-dashboard-shell mx-auto flex w-full max-w-[1180px] flex-col items-center">
        <Suspense fallback={<ManagerWelcomePanel greeting={greeting} managerName={managerName} roleLabel={roleLabel(session.role)} summaryLoading />}>
          <ManagerWelcomeWithSummary session={session} greeting={greeting} managerName={managerName} />
        </Suspense>
        {session.assignedStoreId ? (
          <Suspense fallback={null}>
            <WarmReceptionistPOSCatalog storeId={session.assignedStoreId} />
          </Suspense>
        ) : null}
        <ManagerPOSRoutePreloader />
        <ManagerDashboardActions pendingOrderCount={pendingOrderCount} />
        {franchiseStore?.data?.franchise_id ? <Link href={"/dashboard/manager/supply" as never} className="mt-6 inline-flex min-h-10 items-center rounded-lg border border-emerald-400/60 bg-emerald-950/80 px-5 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-900">Master Supply →</Link> : null}
      </section>
    </main>
  );
}

async function ManagerWelcomeWithSummary({ session, greeting, managerName }: { session: DashboardSession; greeting: string; managerName: string }) {
  const summary = await getManagerDashboardSummary(session);
  return <ManagerWelcomePanel greeting={greeting} managerName={managerName} roleLabel={roleLabel(session.role)} totalSalesToday={summary.totalSalesToday} loggedInToday={summary.loggedInToday} />;
}

async function WarmReceptionistPOSCatalog({ storeId }: { storeId: string }) {
  await warmReceptionistCatalogForStore(storeId).catch(() => undefined);
  return null;
}
