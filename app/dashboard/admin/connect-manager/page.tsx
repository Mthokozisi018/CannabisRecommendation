import { AdminPageShell } from "@/components/admin/AdminDashboardUI";
import { ConnectManagerForm } from "@/components/admin/ConnectManagerForm";
import { requireAdminUser } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

export default async function ConnectManagerPage() {
  await requireAdminUser();
  return (
    <AdminPageShell>
      <ConnectManagerForm />
    </AdminPageShell>
  );
}
