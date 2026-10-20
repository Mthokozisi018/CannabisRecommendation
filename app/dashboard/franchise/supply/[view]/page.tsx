import { notFound } from "next/navigation";
import { getFranchiseSupplySnapshot } from "@/lib/master-supply/data";
import { MasterSupplyPage } from "@/components/master-supply/MasterSupplyPage";

export const dynamic = "force-dynamic";
export default async function Page({ params, searchParams }: { params: Promise<{ view: string }>; searchParams: Promise<{ requestId?: string; storeId?: string }> }) {
  const { view } = await params;
  if (!["inventory","distribute","history","requests"].includes(view)) notFound();
  const query = await searchParams;
  return <MasterSupplyPage mode={view as "inventory" | "distribute" | "history" | "requests"} snapshot={await getFranchiseSupplySnapshot(view as "inventory" | "distribute" | "history" | "requests")} requestId={query.requestId} storeId={query.storeId} />;
}
