import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardKPIs } from "@/types";

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function KPICards({ kpis }: { kpis: DashboardKPIs }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">MRR Recovered</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(kpis.mrrRecovered)}
          </div>
          <p className="text-xs text-muted-foreground">
            {kpis.totalRecovered} of {kpis.totalFailed} payments this month
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Recovery Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{kpis.recoveryRate}%</div>
          <p className="text-xs text-muted-foreground">
            {kpis.activeInDunning} payments currently in dunning
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Annual Value Saved
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(kpis.annualValueSaved)}
          </div>
          <p className="text-xs text-muted-foreground">
            Projected from this month&apos;s recovery rate
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
