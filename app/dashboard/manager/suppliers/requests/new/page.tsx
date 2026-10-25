import { ManagerSupplyRequestForm } from "@/components/manager/ManagerSupplyRequests";
import { getManagerSupplyRequests } from "@/lib/manager/supply-requests";
export const dynamic = "force-dynamic";
export default async function Page() {
  const data = await getManagerSupplyRequests();
  return <ManagerSupplyRequestForm key={`${data.context.store_id}:${data.context.franchise_id}`} data={data}/>;
}
