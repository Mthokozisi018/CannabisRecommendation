import { Suspense } from "react";
import { ManagerDashboardActions } from "@/components/manager/ManagerDashboardActions";
import { ManagerWelcomePanel } from "@/components/manager/ManagerWelcomePanel";
import { getManagerDashboardSummary } from "@/lib/manager/dashboard-summary";
import type { DashboardSession } from "@/lib/dashboard-session";
import { requireCompletedManagerDashboardSession } from "@/lib/manager/onboarding";

export const dynamic = "force-dynamic";

function managerGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning,";
  if (hour < 18) return "Good afternoon,";
  return "Good evening,";
}

function firstName(displayName: string) {
  return displayName.trim().split(/\s+/)[0] || "Manager";
}

function roleLabel(role: string) {
  if (role === "manager") return "Store Manager";
  return role
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function ManagerDashboardPage() {
  const session = await requireCompletedManagerDashboardSession();
  const managerName = firstName(session.displayName || "Manager");
  const greeting = managerGreeting();

  return (
    <main className="relative isolate flex min-h-screen items-start px-4 pb-8 pt-8 sm:px-6 sm:pt-10 lg:px-[clamp(2rem,8vw,8.5rem)] lg:pt-[clamp(3rem,10vh,7rem)]">
      <section className="mx-auto flex w-full max-w-[1180px] flex-col items-center">
        <Suspense fallback={<ManagerWelcomePanel greeting={greeting} managerName={managerName} roleLabel={roleLabel(session.role)} summaryLoading />}>
          <ManagerWelcomeWithSummary session={session} greeting={greeting} managerName={managerName} />
        </Suspense>
        <ManagerDashboardActions />
      </section>
    </main>
  );
}

async function ManagerWelcomeWithSummary({ session, greeting, managerName }: { session: DashboardSession; greeting: string; managerName: string }) {
  const summary = await getManagerDashboardSummary(session);
  return <ManagerWelcomePanel greeting={greeting} managerName={managerName} roleLabel={roleLabel(session.role)} totalSalesToday={summary.totalSalesToday} loggedInToday={summary.loggedInToday} />;
}
