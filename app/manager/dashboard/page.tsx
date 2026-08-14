import { redirect } from "next/navigation";
import { requireCompletedManagerDashboardSession } from "@/lib/manager/onboarding";

export const dynamic = "force-dynamic";

export default async function ManagerDashboardAliasPage() {
  await requireCompletedManagerDashboardSession();
  redirect("/dashboard/manager");
}
