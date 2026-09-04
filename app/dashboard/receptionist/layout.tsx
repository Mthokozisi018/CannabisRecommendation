import { redirect } from "next/navigation";
import { DashboardBackdrop } from "@/components/GreenChoiceDashboard";
import { requireCompletedReceptionistDashboardSession } from "@/lib/dashboard-session";
import { enforceStoreSubscriptionAccess } from "@/lib/manager/subscription";

export const dynamic = "force-dynamic";

export default async function ReceptionistDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireCompletedReceptionistDashboardSession();
  const billingAccess = await enforceStoreSubscriptionAccess(session.storeId, session.isManager ? session.authUserId : null);
  if (!billingAccess.allowed) redirect("/dashboard/restricted/billing" as never);

  return (
    <>
      <DashboardBackdrop variant="receptionist" />
      {children}
    </>
  );
}
