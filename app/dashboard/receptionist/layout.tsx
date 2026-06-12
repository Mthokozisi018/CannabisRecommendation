import { DashboardBackdrop } from "@/components/GreenChoiceDashboard";
import { requireDashboardRole } from "@/lib/dashboard-auth";

export const dynamic = "force-dynamic";

export default async function ReceptionistDashboardLayout({ children }: { children: React.ReactNode }) {
  await requireDashboardRole(["employee_receptionist"]);
  return (
    <>
      <DashboardBackdrop />
      {children}
    </>
  );
}
