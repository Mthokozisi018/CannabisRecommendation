import { ReceptionistPOSPage } from "@/components/receptionist/ReceptionistPOSPage";
import { requireCompletedReceptionistDashboardSession } from "@/lib/dashboard-session";

export const dynamic = "force-dynamic";

export default async function ReceptionistDashboardPage() {
  await requireCompletedReceptionistDashboardSession();
  return <ReceptionistPOSPage />;
}
