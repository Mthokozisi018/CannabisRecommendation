import Link from "next/link";
import { Suspense } from "react";
import { HomeSkeleton } from "@/components/franchise/Loading";
import { ArrowRight, ChartColumn, Crown, Store, Truck, Users } from "lucide-react";
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
          <div className={styles.compact}>
            <div className={styles.actions}>
              <Users className={styles.accent} size={24} />
              <p>Managers Logged In Today</p>
              <b className={styles.accent}>{loggedIn.length}</b>
            </div>
            <div className={styles.loginList}>
              {loggedIn.length ? (
                loggedIn.map((m) => <p key={m.id}>{m.full_name || m.email}</p>)
              ) : (
                <p className={styles.muted}>No manager logins recorded today</p>
              )}
            </div>
            <p className={`${styles.muted} ${styles.section}`}>
              Total Active Managers{" "}
              <b className={styles.accent}>{activeManagers}</b>
            </p>
          </div>
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
      color: "#54e855",
    },
    {
      title: "Manage Store",
      href: "/dashboard/franchise/stores",
      icon: Users,
      color: "#e6bb14",
    },
    {
      title: "Sales and Performance",
      href: "/dashboard/franchise/sales",
      icon: ChartColumn,
      color: "#12d9e1",
    },
    {
      title: "Master Supply Management",
      href: "/dashboard/franchise/supply",
      icon: Truck,
      color: "#16d99d",
    },
  ];
  return (
    <div className={styles.home}>
      <Suspense fallback={<HomeSkeleton />}>
        <HomeWelcome />
      </Suspense>
      <nav aria-label="Franchise main navigation" className={styles.cards}>
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href as never}
              data-navigation-loading={card.href === "/dashboard/franchise/sales" ? "franchise-sales" : card.href === "/dashboard/franchise/stores" ? "franchise-stores" : undefined}
              className={styles.mainCard}
              style={{ "--tone": card.color } as React.CSSProperties}
            >
              <span className={styles.roundIcon}>
                <Icon size={52} />
              </span>
              <h2>{card.title}</h2>
              <span className={styles.rule} />
              <span className={styles.arrow}>
                <ArrowRight size={25} />
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
