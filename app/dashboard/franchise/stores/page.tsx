import { getFranchiseDirectory } from "@/lib/franchise/data";
import { StoreDirectory } from "@/components/franchise/StoreDirectory";
export default async function StoresPage() {
  const { stores, staff } = await getFranchiseDirectory();
  return <StoreDirectory stores={stores} staff={staff} />;
}
