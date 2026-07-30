import { DashboardBackdrop } from "@/components/GreenChoiceDashboard";
import { requireCompletedManagerDashboardSession } from "@/lib/manager/onboarding";

export const dynamic = "force-dynamic";

export default async function ManagerDashboardLayout({ children }: { children: React.ReactNode }) {
  await requireCompletedManagerDashboardSession();
  return (
    <>
      <DashboardBackdrop variant="manager" />
      {children}
    </>
  );
}
