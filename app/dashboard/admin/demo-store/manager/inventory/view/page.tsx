import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function AdminDemoViewInventoryPage() {
  redirect("/dashboard/admin/demo-store/manager/inventory" as never);
}
