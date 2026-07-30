import { DashboardBackdrop } from "@/components/GreenChoiceDashboard";
import { requireUnrestrictedStaffRoute } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

export default async function ReceptionistDashboardLayout({ children }: { children: React.ReactNode }) {
  await requireUnrestrictedStaffRoute("receptionist");
  return (
    <>
      <DashboardBackdrop variant="receptionist" />
      {children}
    </>
  );
}
