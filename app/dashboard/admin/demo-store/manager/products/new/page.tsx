import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function AdminDemoAddProductPage() {
  redirect("/dashboard/admin/demo-store/manager/inventory/manage" as never);
}
