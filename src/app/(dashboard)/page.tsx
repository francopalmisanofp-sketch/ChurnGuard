import { KPICards } from "@/components/dashboard/kpi-cards";
import { PaymentsTable } from "@/components/dashboard/payments-table";
import { getDashboardKPIs, getPayments } from "@/app/actions/payments";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [kpis, { payments }] = await Promise.all([
    getDashboardKPIs(),
    getPayments(undefined, 1, 10),
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
      <div>
        <h2 className="mb-3 text-lg font-semibold">Recent Failed Payments</h2>
        <PaymentsTable payments={payments} />
      </div>
    </div>
  );
}
