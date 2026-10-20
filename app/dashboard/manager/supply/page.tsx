import { DashboardBackdrop } from "@/components/DashboardBackdrop";
import { MasterSupplyPage } from "@/components/master-supply/MasterSupplyPage";
import { getManagerSupplySnapshot } from "@/lib/master-supply/data";

export const dynamic = "force-dynamic";
export default async function Page() {
  return <div className="relative isolate min-h-screen"><DashboardBackdrop variant="receptionist" /><MasterSupplyPage mode="manager" snapshot={await getManagerSupplySnapshot()} /></div>;
}
