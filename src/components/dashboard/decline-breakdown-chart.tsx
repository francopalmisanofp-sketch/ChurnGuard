"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DeclineBreakdownItem } from "@/types";

const COLORS: Record<string, string> = {
  soft: "#3b82f6",
  hard: "#ef4444",
  sca_required: "#f59e0b",
};

const LABELS: Record<string, string> = {
  soft: "Soft Decline",
  hard: "Hard Decline",
  sca_required: "SCA Required",
};

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: DeclineBreakdownItem & { name: string } }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border bg-background p-2 text-sm shadow-sm">
      <p className="font-medium">{LABELS[d.declineType] ?? d.declineType}</p>
      <p className="text-muted-foreground">{d.count} payments</p>
    </div>
  );
}

export function DeclineBreakdownChart({ data }: { data: DeclineBreakdownItem[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Decline Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            No data yet
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="count"
                  nameKey="declineType"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {data.map((entry) => (
                    <Cell
                      key={entry.declineType}
                      fill={COLORS[entry.declineType] ?? "#94a3b8"}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 text-xs">
              {data.map((entry) => (
                <div key={entry.declineType} className="flex items-center gap-1.5">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: COLORS[entry.declineType] ?? "#94a3b8" }}
                  />
                  <span className="text-muted-foreground">
                    {LABELS[entry.declineType] ?? entry.declineType}{" "}
                    ({Math.round((entry.count / total) * 100)}%)
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
