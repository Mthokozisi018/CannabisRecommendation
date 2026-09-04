import { redirect } from "next/navigation";
import { DashboardBackdrop } from "@/components/GreenChoiceDashboard";
import { ManagerAccountMenu } from "@/components/manager/ManagerAccountMenu";
import { requireCompletedManagerDashboardSession } from "@/lib/manager/onboarding";
import { enforceStoreSubscriptionAccess } from "@/lib/manager/subscription";

export const dynamic = "force-dynamic";

export default async function ManagerDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireCompletedManagerDashboardSession();
  const billingAccess = await enforceStoreSubscriptionAccess(session.storeId, session.authUserId);
  if (!billingAccess.allowed) redirect("/dashboard/restricted/billing" as never);

  return (
    <>
      <DashboardBackdrop variant="manager" />
      <ManagerAccountMenu managerName={session.displayName} storeName={session.storeName} />
      {children}
    </>
  );
}
