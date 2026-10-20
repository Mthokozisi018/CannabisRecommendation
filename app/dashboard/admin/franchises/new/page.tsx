import { requireAdmin } from "@/lib/admin-auth";
import { RegisterFranchiseForm } from "@/components/franchise/Forms";
import { AdminPageShell } from "@/components/admin/AdminDashboardUI";
import styles from "@/components/franchise/Franchise.module.css";
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ franchiseId?: string }>;
}) {
  await requireAdmin();
  const { franchiseId } = await searchParams;
  return (
    <AdminPageShell>
      <div className={styles.titleRow}>
        <h1 className={styles.heading}>Register New Franchise</h1>
      </div>
      <RegisterFranchiseForm franchiseId={franchiseId} />
    </AdminPageShell>
  );
}
