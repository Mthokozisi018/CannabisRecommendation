import Link from "next/link";
import { logoutGreenChoiceStaffAction } from "@/app/actions";
import { requireFranchiseAdmin } from "@/lib/franchise/auth";
import { DashboardBackdrop } from "@/components/DashboardBackdrop";
import styles from "@/components/franchise/Franchise.module.css";
import { FranchiseDashboardBack } from "@/components/franchise/FranchiseDashboardBack";
import { FranchiseSalesNavigation } from "@/components/franchise/FranchiseSalesNavigation";
import { FranchiseStoresNavigation } from "@/components/franchise/FranchiseStoresNavigation";
export const dynamic = "force-dynamic";
export default async function FranchiseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session } = await requireFranchiseAdmin();
  return (
    <FranchiseSalesNavigation>
      <FranchiseStoresNavigation>
        <main className={styles.shell}>
          <DashboardBackdrop
            variant="manager"
            image="/images/franchise/dashboard-wallpaper.webp"
          />
          <header className={styles.header}>
            <Link href={"/dashboard/franchise" as never} className={styles.brand}>
              <span>Green</span>Choice
            </Link>
            <div className={styles.nav}>
              <span className={styles.headerIdentity}>
                <span>{session.displayName}</span>
                <span className={styles.headerRole}>Franchise Administrator</span>
              </span>
              <form action={logoutGreenChoiceStaffAction}>
                <button className={styles.button}>Sign out</button>
              </form>
            </div>
          </header>
          <FranchiseDashboardBack />
          {children}
        </main>
      </FranchiseStoresNavigation>
    </FranchiseSalesNavigation>
  );
}
