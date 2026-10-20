import { AdminPageShell } from "@/components/admin/AdminDashboardUI";
import { CreateManagerAccountForm } from "@/components/admin/ConnectManagerForm";
import { requireAdminUser } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

export default async function CreateManagerAccountPage() {
  await requireAdminUser();
  return (
    <AdminPageShell>
      <CreateManagerAccountForm />
    </AdminPageShell>
  );
}
