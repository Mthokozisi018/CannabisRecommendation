import { AdminPageShell } from "@/components/admin/AdminDashboardUI";
import { InviteManagerForm } from "@/components/admin/InviteManagerForm";
import { requireAdminUser } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

export default async function InviteManagerPage() {
  await requireAdminUser();
  return (
    <AdminPageShell>
      <InviteManagerForm />
    </AdminPageShell>
  );
}
