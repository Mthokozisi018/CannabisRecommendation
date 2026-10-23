import { ManagerSupplyRequests } from "@/components/manager/ManagerSupplyRequests";
import { getManagerSupplyRequests } from "@/lib/manager/supply-requests";
export const dynamic = "force-dynamic";
export default async function Page() {
  return <ManagerSupplyRequests data={await getManagerSupplyRequests()}/>;
}
