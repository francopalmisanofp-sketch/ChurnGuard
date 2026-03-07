"use client";

import { useState, useTransition } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMrrTrend } from "@/app/actions/payments";
import type { MrrTrendPoint } from "@/types";

function formatMonth(period: string) {
  const date = new Date(period + "T00:00:00");
  return date.toLocaleString("en-US", { month: "short" });
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: MrrTrendPoint }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border bg-background p-3 text-sm shadow-sm">
      <p className="font-medium">{formatMonth(d.period)}</p>
      <p className="text-emerald-600">MRR Saved: {formatCurrency(d.mrrSaved)}</p>
      <p className="text-muted-foreground">
        {d.totalRecovered} / {d.totalFailed} recovered
      </p>
    </div>
  );
}

const ranges = [3, 6, 12] as const;

export function MrrTrendChart({ initialData }: { initialData: MrrTrendPoint[] }) {
  const [data, setData] = useState(initialData);
  const [activeRange, setActiveRange] = useState<number>(6);
  const [isPending, startTransition] = useTransition();

  function handleRangeChange(value: string) {
    const months = Number(value);
    setActiveRange(months);
    startTransition(async () => {
      const result = await getMrrTrend(months);
      setData(result);
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">MRR Recovered Trend</CardTitle>
        <Tabs value={String(activeRange)} onValueChange={handleRangeChange}>
          <TabsList className="h-8">
            {ranges.map((r) => (
              <TabsTrigger key={r} value={String(r)} className="text-xs px-2">
                {r}m
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            No data yet
          </div>
        ) : (
          <div className={isPending ? "opacity-50 transition-opacity" : ""}>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="period"
                  tickFormatter={formatMonth}
                  className="text-xs"
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  tickFormatter={(v: number) => formatCurrency(v)}
                  className="text-xs"
                  tick={{ fontSize: 12 }}
                  width={70}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="mrrSaved"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#mrrGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
