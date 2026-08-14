import { ManagerOnboardingCompleteScreen } from "@/components/manager/ManagerOnboarding";
import { requireManagerOnboardingCompletePage } from "@/lib/manager/onboarding";

export const dynamic = "force-dynamic";

export default async function ManagerOnboardingCompletePage() {
  await requireManagerOnboardingCompletePage();
  return <ManagerOnboardingCompleteScreen />;
}
