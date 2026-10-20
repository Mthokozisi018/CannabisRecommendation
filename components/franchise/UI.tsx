import Link from "next/link";
import Form from "next/form";
import Image from "next/image";
import { Banknote, CalendarDays, Users, ChartColumn } from "lucide-react";
import {
  FRANCHISE_STORE_IMAGE,
  type FranchiseStore,
} from "@/lib/franchise/types";
import styles from "./Franchise.module.css";
import { RevenuePlot } from "./RevenuePlot";
import { RevenueBars } from "./RevenueBars";
import type { RevenuePoint } from "@/lib/franchise/revenue-reporting";
const moneyFormatter = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  maximumFractionDigits: 2,
});
export const money = (value: number) => moneyFormatter.format(value);
const dateFormatter = new Intl.DateTimeFormat("en-ZA", {
  timeZone: "Africa/Johannesburg",
  dateStyle: "medium",
});
export const dateLabel = (value: string) =>
  dateFormatter.format(new Date(value));
export function Status({ active, label }: { active: boolean; label?: string }) {
  return (
    <span className={`${styles.badge} ${active ? "" : styles.inactive}`}>
      <span aria-hidden>●</span>
      {label || (active ? "Active" : "Inactive")}
    </span>
  );
}
export function StoreImage({
  store,
  eager = false,
}: {
  store: Pick<FranchiseStore, "store_image_url" | "name">;
  eager?: boolean;
}) {
  return (
    <Image
      unoptimized
      loading={eager ? "eager" : "lazy"}
      src={store.store_image_url || FRANCHISE_STORE_IMAGE}
      alt={`${store.name} storefront`}
      width={640}
      height={360}
    />
  );
}
export function StoreBanner({ store }: { store: Pick<FranchiseStore, "name" | "store_image_url" | "is_active" | "store_access_status" | "physical_store_address" | "city" | "province" | "postal_code" | "store_phone_number" | "store_contact_email" | "created_at"> }) {
  return (
    <section className={`${styles.panel} ${styles.banner}`}>
      <StoreImage store={store} eager />
      <div>
        <div className={styles.actions}>
          <h1 className={styles.heading}>{store.name}</h1>
          <Status
            active={store.is_active && store.store_access_status === "active"}
          />
        </div>
        <p className={styles.muted}>
          {[
            store.physical_store_address,
            store.city,
            store.province,
            store.postal_code,
          ]
            .filter(Boolean)
            .join(", ")}
        </p>
        <div className={styles.details}>
          <span>{store.store_phone_number || "No phone recorded"}</span>
          <span>{store.store_contact_email || "No email recorded"}</span>
          <span>Registered {dateLabel(store.created_at)}</span>
        </div>
      </div>
    </section>
  );
}
export function Kpis({
  values,
  compact = false,
}: {
  values: { label: string; value: number; currency?: boolean }[];
  compact?: boolean;
}) {
  const icons = [Banknote, CalendarDays, ChartColumn, Users];
  const revenueStyles: Record<string, number> = {
    "Revenue This Month": 0,
    "Revenue This Year": 1,
    "Revenue This Week": 2,
    "Total Customers": 3,
  };
  return (
    <div className={`${styles.kpis} ${compact ? styles.kpisCompact : ""}`}>
      {values.map((v, i) => {
        const appearance = compact
          ? (revenueStyles[v.label] ?? i % icons.length)
          : i % icons.length;
        const Icon = icons[appearance];
        return (
          <div
            className={`${styles.panel} ${styles.kpi}`}
            key={v.label}
            data-kpi-appearance={appearance}
          >
            <span className={styles.kpiIcon}>
              <Icon size={23} />
            </span>
            <div>
              <p className={styles.muted}>{v.label}</p>
              <strong>
                {v.currency ? money(v.value) : v.value.toLocaleString("en-ZA")}
              </strong>
            </div>
          </div>
        );
      })}
    </div>
  );
}
export function Empty({ children }: { children: React.ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}
export function PeriodControl({ from, to }: { from: string; to: string }) {
  return (
    <Form action={"" as never} className={styles.dateForm}>
      <label className={styles.field}>
        From
        <input type="date" name="from" defaultValue={from} required />
      </label>
      <label className={styles.field}>
        To
        <input type="date" name="to" defaultValue={to} required />
      </label>
      <button className={styles.button}>Apply period</button>
    </Form>
  );
}
export function RevenueChart({
  values,
  title = "Revenue over time",
  header,
  period,
  xAxisTitle,
  fitPeriod = false,
  emptyMessage,
}: {
  values: RevenuePoint[];
  title?: string;
  header?: React.ReactNode;
  period?: { preset: string; from: string; to: string };
  xAxisTitle?: string;
  fitPeriod?: boolean;
  emptyMessage?: string;
}) {
  return (
    <section className={styles.panel}>
      {header || (
        <>
          <h2>{title}</h2>
          <p className={styles.muted}>Completed sales · selected period</p>
        </>
      )}
      {values.length ? (
        <>
          <RevenuePlot values={values} title={title} period={period} xAxisTitle={xAxisTitle} fitPeriod={fitPeriod} />
          {!values.some((v) => (v.value ?? 0) > 0) ? <Empty>{emptyMessage || "No sales in this period."}</Empty> : null}
          <details className={styles.muted}>
            <summary>View chart data</summary>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {values.map((v) => (
                    <tr key={v.label}>
                      <td>{v.label}</td>
                      <td>{v.value === null ? v.unavailableLabel || "Not started" : money(v.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ) : (
        <Empty>{emptyMessage || "No sales in this period."}</Empty>
      )}
    </section>
  );
}
export function BarChart({
  values,
  title,
  header,
  expanded = false,
}: {
  values: { label: string; value: number }[];
  title: string;
  header?: React.ReactNode;
  expanded?: boolean;
}) {
  return (
    <section className={styles.panel}>
      {header || (
        <>
          <h2>{title}</h2>
          <p className={styles.muted}>Total revenue for the selected period</p>
        </>
      )}
      {values.length ? (
        <RevenueBars values={values} title={title} expanded={expanded} />
      ) : (
        <Empty>No sales in this period.</Empty>
      )}
    </section>
  );
}
export function Back({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link className={styles.button} href={href as never}>
      ← {children}
    </Link>
  );
}
