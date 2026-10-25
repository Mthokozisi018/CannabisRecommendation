import { Suspense } from "react";
import { HomeSkeleton } from "@/components/franchise/Loading";
import { ChartColumn, Crown, Store, Truck, Users } from "lucide-react";
import { LoggedInManagers } from "@/components/franchise/LoggedInManagers";
import { DashboardActionCard, type CardTone } from "@/components/manager/ManagerDashboardActions";
import { getFranchiseHome } from "@/lib/franchise/data";
import { datePartsInTimeZone } from "@/lib/manager/report-calendar";
import { money } from "@/components/franchise/UI";
import styles from "@/components/franchise/Franchise.module.css";
async function HomeWelcome() {
  const { session, franchise, salesToday, loggedIn, activeManagers } =
    await getFranchiseHome();
  const hour = datePartsInTimeZone(new Date()).hour;
  return (
    <>
      <section className={`${styles.panel} ${styles.welcome}`}>
        <div>
          <div className={styles.identity}>
            <span className={styles.roundIcon}>
              <Crown size={38} />
            </span>
            <div>
              <p className={styles.greeting}>
                Good{" "}
                {hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"},
              </p>
              <h1>{session.profile.first_name || session.displayName}</h1>
              <p>
                You&apos;re logged in as{" "}
                <strong className={styles.accent}>
                  Franchise Administrator
                </strong>
              </p>
            </div>
          </div>
          <div className={styles.franchiseName}>
            <h2>{franchise.name}</h2>
          </div>
        </div>
        <div>
          <div className={styles.compact}>
            <p>Total Franchise Sales Today</p>
            <strong>{money(salesToday)}</strong>
          </div>
          <LoggedInManagers
            managers={loggedIn.map((manager) => ({ id: manager.id, name: manager.full_name || manager.email }))}
            activeManagers={activeManagers}
          />
        </div>
      </section>
    </>
  );
}

export default function FranchiseHomePage() {
  const cards = [
    {
      title: "Add Store",
      href: "/dashboard/franchise/stores/new",
      icon: Store,
      tone: "green" as CardTone,
      color: styles.navEmerald,
    },
    {
      title: "Manage Store",
      href: "/dashboard/franchise/stores",
      icon: Users,
      tone: "blue" as CardTone,
      color: styles.navRoyalBlue,
    },
    {
      title: "Master Supply Management",
      href: "/dashboard/franchise/supply",
      icon: Truck,
      tone: "purple" as CardTone,
      color: styles.navViolet,
    },
    {
      title: "Sales and Performance",
      href: "/dashboard/franchise/sales",
      icon: ChartColumn,
      tone: "amber" as CardTone,
      color: styles.navOrange,
    },
  ];
  return (
    <div className={styles.home}>
      <Suspense fallback={<HomeSkeleton />}>
        <HomeWelcome />
      </Suspense>
      <nav aria-label="Franchise main navigation" className="mx-auto mt-8 grid w-full max-w-[200px] grid-cols-1 justify-items-center gap-5 min-[361px]:max-w-[24rem] min-[361px]:grid-cols-2 sm:max-w-[440px] sm:gap-6 lg:max-w-[880px] lg:grid-cols-4">
        {cards.map(({ color, ...card }) => (
          <DashboardActionCard
            key={card.href}
            {...card}
            className={`${styles.franchiseNavCard} ${color}`}
            hoverLift={false}
            navigationLoading={card.href === "/dashboard/franchise/sales" ? "franchise-sales" : card.href === "/dashboard/franchise/stores" ? "franchise-stores" : undefined}
          />
        ))}
      </nav>
    </div>
  );
}
