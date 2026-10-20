import { getFranchiseSupplySnapshot } from "@/lib/master-supply/data";
import { MasterSupplyPage } from "@/components/master-supply/MasterSupplyPage";

export const dynamic = "force-dynamic";
export default async function Page() {
  return <MasterSupplyPage mode="overview" snapshot={await getFranchiseSupplySnapshot()} />;
}
