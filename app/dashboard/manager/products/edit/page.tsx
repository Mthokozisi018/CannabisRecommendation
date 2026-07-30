import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function EditProductCardsPage() {
  redirect("/dashboard/manager/inventory" as never);
}
