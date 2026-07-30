import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function AddStockHubPage() {
  redirect("/dashboard/manager/inventory/manage" as never);
}
