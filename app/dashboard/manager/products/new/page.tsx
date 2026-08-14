import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function AddProductPage() {
  redirect("/dashboard/manager/inventory/manage" as never);
}
