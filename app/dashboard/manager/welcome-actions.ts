"use server";

import { redirect } from "next/navigation";
import { billingDb } from "@/lib/billing/accounts";
import { requireCompletedManagerDashboardSession } from "@/lib/manager/onboarding";
import { managerWelcomeIsAvailable } from "@/lib/manager/welcome";
import { verifyOrigin } from "@/lib/security";

export async function completeManagerWelcomeAction() {
  await verifyOrigin();
  const session = await requireCompletedManagerDashboardSession();
  if (await managerWelcomeIsAvailable(session)) {
    const { error } = await billingDb().from("manager_welcome_completions")
      .upsert({ profile_id: session.staffProfileId }, { onConflict: "profile_id", ignoreDuplicates: true });
    if (error) throw new Error("Manager welcome could not be completed.");
  }
  redirect("/dashboard/manager" as never);
}
