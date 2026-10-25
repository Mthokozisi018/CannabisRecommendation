"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ChevronsUpDown, MapPin, UserRound } from "lucide-react";
import { periodStoreTotals, type DailySnapshot, type OverviewPeriod } from "@/lib/franchise/overview-periods";
import type { FranchiseStore } from "@/lib/franchise/types";
import { dateLabel, Empty, money, Status, StoreImage } from "./UI";
import styles from "./Franchise.module.css";

export type StoreRow = {
  store: FranchiseStore;
  managers: { id: string; full_name: string | null; email: string }[];
  customers: number;
};
type SortColumn = "Store" | "Store Manager" | "Location" | "Status";
const managerName = (manager: StoreRow["managers"][number]) => manager.full_name?.trim() || manager.email;
const location = (store: FranchiseStore) => [store.city, store.province].filter(Boolean).join(", ");

export function StorePerformanceTable({ stores, period, snapshot, header, search, revenueControl }: {
  stores: StoreRow[];
  period: OverviewPeriod;
  snapshot: DailySnapshot;
  header: React.ReactNode;
  search: string;
  revenueControl: React.ReactNode;
}) {
  const [sort, setSort] = useState<{ column: SortColumn; descending: boolean } | null>(null);
  const totals = periodStoreTotals(snapshot.daily, period);
  const query = search.trim().toLocaleLowerCase();
  const rows = stores.filter(({ store, managers }) => [store.name, store.slug, location(store), store.physical_store_address,
    ...managers.flatMap((manager) => [managerName(manager), manager.email])].filter(Boolean).join(" ").toLocaleLowerCase().includes(query));
  function sortValue(row: StoreRow, column: SortColumn) {
    if (column === "Store") return row.store.name;
    if (column === "Store Manager") return row.managers.map(managerName).join(", ");
    if (column === "Location") return location(row.store);
    return row.store.is_active && row.store.store_access_status === "active" ? "Active" : "Inactive";
  }
  if (sort) rows.sort((a, b) => sortValue(a, sort.column).localeCompare(sortValue(b, sort.column)) * (sort.descending ? -1 : 1));
  function sortableHeader(column: SortColumn) {
    return <th scope="col" aria-sort={sort?.column === column ? sort.descending ? "descending" : "ascending" : "none"}>
      <button className={styles.performanceSort} onClick={() => setSort({ column, descending: sort?.column === column && !sort.descending })}>
        {column}<ChevronsUpDown size={14} aria-hidden="true" />
      </button>
    </th>;
  }
  return <section className={`${styles.panel} ${styles.performancePanel}`}>
    {header}
    <div className={styles.tableWrap} role="region" aria-label="Store performance results" tabIndex={0}>
      <table className={`${styles.table} ${styles.performanceTable}`}>
        <colgroup>{[17, 19, 17, 14, 9, 11, 13].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup>
        <thead><tr>
          {sortableHeader("Store")}{sortableHeader("Store Manager")}{sortableHeader("Location")}
          <th scope="col"><div className={styles.performanceRevenueHeader}>Revenue
            {revenueControl}
          </div></th>
          {sortableHeader("Status")}<th scope="col">Date Registered</th><th scope="col">Actions</th>
        </tr></thead>
        <tbody>{rows.map(({ store, managers }) => <tr key={store.id}>
          <td><div className={styles.performanceIdentity}><StoreImage store={store} /><div><strong>{store.name}</strong>{store.slug ? <span className={styles.performanceSecondary}>{store.slug}</span> : null}</div></div></td>
          <td><div className={styles.performanceManagers}>{managers.length ? managers.map((manager) => <div key={manager.id} className={styles.performanceIdentity}>
            <span className={styles.performanceAvatar} aria-hidden="true">{manager.full_name?.trim() ? manager.full_name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() : <UserRound size={19} />}</span>
            <div><span>{managerName(manager)}</span><span className={styles.performanceSecondary}>{manager.email}</span></div>
          </div>) : <div className={styles.performanceIdentity}><span className={`${styles.performanceAvatar} ${styles.performanceUnassigned}`} aria-hidden="true"><UserRound size={19} /></span><span>Not assigned</span></div>}</div></td>
          <td><div className={styles.performanceLocation}><MapPin size={20} aria-hidden="true" /><div><span>{location(store) || "Location not recorded"}</span><span className={styles.performanceSecondary}>{[store.physical_store_address, store.postal_code].filter(Boolean).join(", ") || "Address not recorded"}</span></div></div></td>
          <td className={styles.performanceRevenue}>{money(totals.get(store.id)?.revenue || 0)}</td>
          <td><Status active={store.is_active && store.store_access_status === "active"} /></td>
          <td>{dateLabel(store.created_at)}</td>
          <td><Link className={styles.performanceView} href={`/dashboard/franchise/sales/${store.id}?from=${period.from}&to=${period.to}` as never} aria-label={`View Store ${store.name}`}>View Store <ArrowRight size={18} aria-hidden="true" /></Link></td>
        </tr>)}</tbody>
      </table>
    </div>
    {!rows.length ? <Empty>{stores.length ? "No stores match your search." : "No stores yet."}</Empty> : null}
  </section>;
}
