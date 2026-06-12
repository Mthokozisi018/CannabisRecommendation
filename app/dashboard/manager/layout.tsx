import { DashboardBackdrop } from "@/components/GreenChoiceDashboard";
import { requireDashboardRole } from "@/lib/dashboard-auth";

export const dynamic = "force-dynamic";

export default async function ManagerDashboardLayout({ children }: { children: React.ReactNode }) {
  await requireDashboardRole(["manager"]);
  return (
    <>
      <DashboardBackdrop />
      {children}
    </>
  );
}
