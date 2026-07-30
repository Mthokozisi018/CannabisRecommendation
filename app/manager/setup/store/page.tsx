import { StoreRegistrationForm } from "@/components/manager/ManagerOnboarding";
import { requireManagerSetupStep, storeRegistrationInitialValues } from "@/lib/manager/onboarding";

export const dynamic = "force-dynamic";

export default async function StoreRegistrationPage() {
  const { profile } = await requireManagerSetupStep("store");
  return <StoreRegistrationForm initialValues={storeRegistrationInitialValues(profile)} />;
}
