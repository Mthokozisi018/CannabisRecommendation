import { SavedCartView } from "@/components/SavedCartView";

export default async function SavedCartPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SavedCartView id={id} />;
}
