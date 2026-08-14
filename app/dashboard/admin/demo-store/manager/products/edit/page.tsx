import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function AdminDemoEditProductCardsPage() {
  redirect("/dashboard/admin/demo-store/manager/inventory" as never);
}
