import { getFranchiseReport } from "@/lib/franchise/data";
import { FranchiseSalesOverview } from "@/components/franchise/FranchiseSalesOverview";

export default async function FranchiseSalesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const report = await getFranchiseReport(await searchParams);
  return (
    <FranchiseSalesOverview
      key={`${report.session.authUserId}:${report.franchiseId}`}
      snapshot={report.snapshot}
      historyStart={report.historyStart}
      stores={report.performance.map(({ store, managers, customers }) => ({
        store,
        customers,
        managers: managers.map(({ id, full_name, email }) => ({
          id,
          full_name,
          email,
        })),
      }))}
      now={new Date().toISOString()}
      tablePeriod={{ from: report.period.from, to: report.period.to }}
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
    />
  );
}
