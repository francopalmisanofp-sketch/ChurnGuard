import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FailedPayment } from "@/types";

function formatCurrency(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function statusColor(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "recovered":
      return "default";
    case "in_dunning":
      return "secondary";
    case "hard_churn":
      return "destructive";
    default:
      return "outline";
  }
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function PaymentsTable({ payments }: { payments: FailedPayment[] }) {
  if (payments.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground">
        No failed payments yet. Once your Stripe webhook is connected,
        payments will appear here automatically.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Decline Type</TableHead>
            <TableHead>Step</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((payment) => (
            <TableRow key={payment.id}>
              <TableCell>
                <Link
                  href={`/dashboard/payments/${payment.id}`}
                  className="font-medium hover:underline"
                >
                  {payment.customerEmail}
                </Link>
                {payment.customerName && (
                  <div className="text-xs text-muted-foreground">
                    {payment.customerName}
                  </div>
                )}
              </TableCell>
              <TableCell>
                {formatCurrency(payment.amount, payment.currency)}
              </TableCell>
              <TableCell>
                <Badge variant={statusColor(payment.status)}>
                  {payment.status.replace("_", " ")}
                </Badge>
              </TableCell>
              <TableCell className="capitalize">
                {payment.declineType.replace("_", " ")}
              </TableCell>
              <TableCell>Day {payment.dunningStep * 3 || 0}</TableCell>
              <TableCell>{formatDate(payment.createdAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
