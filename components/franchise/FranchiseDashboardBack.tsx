"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import styles from "./Franchise.module.css";
import { FranchiseSalesHeading } from "./FranchiseSalesHeading";

export function FranchiseDashboardBack() {
  const pathname = usePathname();
  const search = useSearchParams();
  if (pathname === "/dashboard/franchise" || pathname.startsWith("/dashboard/franchise/supply")) return null;
  const storePerformance = pathname.startsWith("/dashboard/franchise/sales/");
  const storeManagement = /^\/dashboard\/franchise\/stores\/(?!new\/?$)[^/]+\/?$/.test(pathname);
  const salesPage = pathname === "/dashboard/franchise/sales" || storePerformance;
  const period = new URLSearchParams();
  for (const key of ["from", "to"]) {
    const value = search.get(key);
    if (value) period.set(key, value);
  }
  const directorySearch = new URLSearchParams();
  const query = search.get("q");
  if (query) directorySearch.set("q", query);
  const href = storePerformance
    ? `/dashboard/franchise/sales${period.size ? `?${period}` : ""}`
    : storeManagement
      ? `/dashboard/franchise/stores${directorySearch.size ? `?${directorySearch}` : ""}`
      : "/dashboard/franchise";

  return (
    <div className={salesPage ? `${styles.salesTitleRow} ${storePerformance ? styles.storeSalesTitleRow : ""}` : styles.dashboardBack}>
      <Link className={styles.button} href={href as never}>
        ← {storePerformance ? "Back to Sales Overview" : storeManagement ? "Back to Manage Stores" : "Back to Dashboard"}
      </Link>
      {salesPage ? <FranchiseSalesHeading storePerformance={storePerformance} /> : null}
    </div>
  );
}
