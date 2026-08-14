import { DashboardBackdrop } from "@/components/GreenChoiceDashboard";
import { requireCompletedReceptionistDashboardSession } from "@/lib/dashboard-session";

export const dynamic = "force-dynamic";

export default async function ReceptionistDashboardLayout({ children }: { children: React.ReactNode }) {
  await requireCompletedReceptionistDashboardSession();
  return (
    <>
      <DashboardBackdrop variant="receptionist" />
      {children}
    </>
  );
}
