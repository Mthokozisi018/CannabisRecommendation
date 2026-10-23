import { redirect } from "next/navigation";
import { requireFranchiseAdmin } from "@/lib/franchise/auth";
import { FranchiseSetupForm } from "@/components/franchise/Forms";
import { DashboardBackdrop } from "@/components/DashboardBackdrop";
import { FranchiseDashboardBack } from "@/components/franchise/FranchiseDashboardBack";
import styles from "@/components/franchise/Franchise.module.css";
export default async function SetupPage() {
  const { session } = await requireFranchiseAdmin(true);
  if (session.accountSetupComplete) redirect("/dashboard/franchise" as never);
  return (
    <main className={styles.shell}>
      <DashboardBackdrop variant="manager" />
      <header className={styles.header}>
        <div className={styles.brand}>
          <span>Green</span>Choice
        </div>
      </header>
      <FranchiseDashboardBack />
      <div className="mx-auto max-w-xl py-4">
        <h1 className={styles.heading}>
          Welcome, {session.profile.first_name}
        </h1>
        <p className={`${styles.muted} mb-6`}>
          Create your permanent password to access your franchise.
        </p>
        <FranchiseSetupForm />
      </div>
    </main>
  );
}
