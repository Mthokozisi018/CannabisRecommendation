import { getStoreManagement } from "@/lib/franchise/data";
import { StoreManagement } from "@/components/franchise/StoreManagement";
export default async function ManageStorePage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const data = await getStoreManagement(storeId);
  return <StoreManagement {...data} />;
}
