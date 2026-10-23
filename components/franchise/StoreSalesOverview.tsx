"use client";
import { netSaleCents } from "@/lib/sales-money";
import { useEffect, useMemo } from "react";
import {
  loadStoreDetailPeriod,
  loadStoreRevenuePeriod,
} from "@/app/dashboard/franchise/sales/actions";
import {
  createOverviewRangeLoader,
  overviewPeriod,
  type DailySnapshot,
} from "@/lib/franchise/overview-periods";
import type { getStoreDetailPeriod } from "@/lib/franchise/data";
import type { FranchiseStore } from "@/lib/franchise/types";
import { FilteredSection } from "./FranchiseSalesOverview";
import { BarChart, Empty, Kpis, money, StoreBanner } from "./UI";
import styles from "./Franchise.module.css";
import { notifySalesLoading, salesLoadingReady } from "./sales-loading-events";
import { FranchiseRevenueReporting } from "./FranchiseRevenueReporting";
type Details = Awaited<ReturnType<typeof getStoreDetailPeriod>>;
export function StoreSalesOverview({
  store,
  managers,
  snapshot,
  details,
  kpis,
  lowStock,
  now,
  historyStart,
}: {
  store: FranchiseStore;
  managers: string;
  snapshot: DailySnapshot;
  details: Details;
  kpis: { label: string; value: number; currency?: boolean }[];
  lowStock: { id: string; name: string; quantity: number; threshold: number }[];
  now: string;
  historyStart?: string | null;
}) {
  useEffect(() => { notifySalesLoading(salesLoadingReady); }, []);
  const revenueLoader = useMemo(
    () =>
      createOverviewRangeLoader(snapshot, (period) =>
        loadStoreRevenuePeriod(store.id, period),
      ),
    [snapshot, store.id],
  );
  const detailLoader = useMemo(
    () =>
      createOverviewRangeLoader(
        details,
        (period) => loadStoreDetailPeriod(store.id, period),
        true,
      ),
    [details, store.id],
  );
  const initial = overviewPeriod("custom", details, new Date(now), historyStart);
  const month = overviewPeriod("month", {}, new Date(now));
  const detailPeriod =
    initial.from === month.from && initial.to === month.to ? month : initial;
  return (
    <div className={styles.salesOverview}>
      <StoreBanner store={store} />
      <p className={styles.muted}>Managers: {managers}</p>
      <Kpis values={kpis} compact />
      <p className={styles.salesNote}>
        Revenue cards use the current South African calendar periods. Customers
        are registered store records. Chart and table presets run through today;
        each section has its own period.
      </p>
      <div className={styles.charts}>
        <FranchiseRevenueReporting
          reportName="Store Revenue"
          preferenceKey={`greenchoice.sales.v3.reporting.store.${store.id}`}
          snapshot={snapshot}
          historyStart={historyStart ?? null}
          now={now}
          loadRange={revenueLoader}
        />
        <FilteredSection
          title="Sales by Category"
          expandable
          initialPeriod={detailPeriod}
          initialSnapshot={details}
          now={now}
          historyStart={historyStart}
          loadRange={detailLoader}
        >
          {(_period, data, header, _revenueControl, expanded) => (
            <BarChart
              title="Sales by Category"
              expanded={expanded}
              values={data.categories}
              header={header}
            />
          )}
        </FilteredSection>
      </div>
      <div className={styles.split}>
        <FilteredSection
          title="Product / Sales Performance"
          initialPeriod={detailPeriod}
          initialSnapshot={details}
          now={now}
          historyStart={historyStart}
          loadRange={detailLoader}
        >
          {(_period, data, header) => (
            <section className={styles.panel}>
              {header}
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Total Sold</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.products.map((p) => (
                      <tr key={p.key}>
                        <td>{p.name}</td>
                        <td>{p.quantity}</td>
                        <td>{money(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.products.length ? (
                <Empty>No product sales in this period.</Empty>
              ) : null}
            </section>
          )}
        </FilteredSection>
        <FilteredSection
          title="Recent Transactions"
          initialPeriod={detailPeriod}
          initialSnapshot={details}
          now={now}
          historyStart={historyStart}
          loadRange={detailLoader}
        >
          {(_period, data, header) => (
            <section className={styles.panel}>
              {header}
              <p className={styles.muted}>
                Latest 20 in the selected period · Transactions in Period:{" "}
                {data.transactionCount.toLocaleString("en-ZA")}
              </p>
              <div className={styles.tableWrap}>
                <table className={`${styles.table} ${styles.recentTransactionsTable}`}>
                  <thead>
                    <tr>
                      <th scope="col">Date &amp; Time</th>
                      <th scope="col">Items</th>
                      <th scope="col">Net Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...data.transactions]
                      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                      .slice(0, 20)
                      .map((t) => (
                        <tr key={t.saleId}>
                          <td>
                            {t.date} {t.time}
                          </td>
                          <td>{t.itemCount}</td>
                          <td>{money(netSaleCents({total:t.recordedTotal,refunded_amount:t.refundedAmount}) / 100)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {!data.transactions.length ? (
                <Empty>No transactions in this period.</Empty>
              ) : null}
            </section>
          )}
        </FilteredSection>
        <section className={styles.panel}>
          <h2>Low Stock Products</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Stock</th>
                  <th>Threshold</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.quantity}</td>
                    <td>{p.threshold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!lowStock.length ? <Empty>No low-stock products.</Empty> : null}
        </section>
      </div>
    </div>
  );
}
