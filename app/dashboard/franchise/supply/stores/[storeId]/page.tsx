import { z } from "zod";
import { notFound } from "next/navigation";
import { getFranchiseStoreSupplySnapshot } from "@/lib/master-supply/data";
import { MasterSupplyPage } from "@/components/master-supply/MasterSupplyPage";

export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!z.string().uuid().safeParse(storeId).success) notFound();
  return <MasterSupplyPage mode="store" snapshot={await getFranchiseStoreSupplySnapshot(storeId)} storeId={storeId} />;
}
