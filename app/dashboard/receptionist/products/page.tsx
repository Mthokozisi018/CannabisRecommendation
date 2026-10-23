import { ReceptionistPOSPage } from "@/components/receptionist/ReceptionistPOSPage";
import { requireCompletedReceptionistDashboardSession } from "@/lib/dashboard-session";

export const dynamic = "force-dynamic";

export default async function ReceptionistProductsPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  await requireCompletedReceptionistDashboardSession();
  const params = await searchParams;
  return <ReceptionistPOSPage category={params.category} />;
}
