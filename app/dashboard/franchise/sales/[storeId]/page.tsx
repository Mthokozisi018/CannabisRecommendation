import { getFranchiseReport, getStoreLowStock } from "@/lib/franchise/data";
import { StoreSalesOverview } from "@/components/franchise/StoreSalesOverview";

export default async function StorePerformancePage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { storeId } = await params;
  const [report, lowStock] = await Promise.all([
    getFranchiseReport(await searchParams, storeId),
    getStoreLowStock(storeId),
  ]);
  const performance = report.performance[0];
  return (
    <StoreSalesOverview
      key={`${report.session.authUserId}:${storeId}`}
      store={performance.store}
      managers={
        performance.managers.map((m) => m.full_name || m.email).join(", ") ||
        "No managers assigned"
      }
      snapshot={report.snapshot}
      historyStart={report.historyStart}
      details={{
        from: report.period.from,
        to: report.period.to,
        categories: report.categories,
        products: report.products,
        transactions: report.transactions,
        transactionCount: report.summary.transactionCount,
      }}
      kpis={[
        {
          label: "Revenue This Week",
          value: report.summary.week,
          currency: true,
        },
        {
          label: "Revenue This Month",
          value: report.summary.month,
          currency: true,
        },
        {
          label: "Revenue This Year",
          value: report.summary.year,
          currency: true,
        },
        { label: "Total Customers", value: report.customers },
      ]}
      lowStock={lowStock}
      now={new Date().toISOString()}
    />
  );
}
