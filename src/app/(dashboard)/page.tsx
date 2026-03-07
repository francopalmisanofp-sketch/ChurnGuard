import { KPICards } from "@/components/dashboard/kpi-cards";
import { PaymentsTable } from "@/components/dashboard/payments-table";
import { MrrTrendChart } from "@/components/dashboard/mrr-trend-chart";
import { DeclineBreakdownChart } from "@/components/dashboard/decline-breakdown-chart";
import {
  getDashboardKPIs,
  getPayments,
  getMrrTrend,
  getDeclineBreakdown,
} from "@/app/actions/payments";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [kpis, { payments }, mrrTrend, declineBreakdown] = await Promise.all([
    getDashboardKPIs(),
    getPayments(undefined, 1, 10),
    getMrrTrend(6),
    getDeclineBreakdown(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Your payment recovery overview for this month
        </p>
      </div>
      <KPICards kpis={kpis} />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <MrrTrendChart initialData={mrrTrend} />
        </div>
        <DeclineBreakdownChart data={declineBreakdown} />
      </div>
      <div>
        <h2 className="mb-3 text-lg font-semibold">Recent Failed Payments</h2>
        <PaymentsTable payments={payments} />
      </div>
    </div>
  );
}
