import { ManagerAccountSetupForm } from "@/components/manager/ManagerOnboarding";
import { getLegalDocumentStatus } from "@/lib/manager/legal-documents";
import { managerAccountInitialValues, requireManagerSetupStep } from "@/lib/manager/onboarding";

export const dynamic = "force-dynamic";

export default async function ManagerAccountSetupPage() {
  const { user, profile } = await requireManagerSetupStep("account");
  return <ManagerAccountSetupForm
    legalDocuments={getLegalDocumentStatus()}
    initialValues={managerAccountInitialValues()}
    mustChangePassword={profile.temporary_password_active === true}
    accountEmail={user.email ?? profile.email}
  />;
}
