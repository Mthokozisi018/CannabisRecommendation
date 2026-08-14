import { ReceptionistPOSPage } from "@/components/receptionist/ReceptionistPOSPage";

export const dynamic = "force-dynamic";

export default async function ReceptionistProductsPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const params = await searchParams;
  return <ReceptionistPOSPage category={params.category} />;
}
