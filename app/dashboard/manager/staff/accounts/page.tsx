import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function StaffAccountsPage() {
  redirect("/dashboard/manager/staff" as never);
}
