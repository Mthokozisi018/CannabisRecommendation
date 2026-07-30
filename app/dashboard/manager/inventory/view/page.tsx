import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function ViewInventoryPage() {
  redirect("/dashboard/manager/inventory" as never);
}
