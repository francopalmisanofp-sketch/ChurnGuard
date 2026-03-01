import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaymentTimeline } from "@/components/dashboard/payment-timeline";
import { getPaymentDetail } from "@/app/actions/payments";

export const metadata = { title: "Payment Detail" };

interface PaymentDetailPageProps {
  params: Promise<{ id: string }>;
}

function formatCurrency(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export default async function PaymentDetailPage({
  params,
}: PaymentDetailPageProps) {
  const { id } = await params;
  const detail = await getPaymentDetail(id);

  if (!detail) {
    notFound();
  }

  const { payment, jobs } = detail;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/payments"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to Payments
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Payment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Customer</span>
              <span className="text-sm font-medium">
                {payment.customerName ?? payment.customerEmail}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="text-sm">{payment.customerEmail}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Amount</span>
              <span className="text-sm font-medium">
                {formatCurrency(payment.amount, payment.currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge
                variant={
                  payment.status === "recovered"
                    ? "default"
                    : payment.status === "hard_churn"
                      ? "destructive"
                      : "secondary"
                }
              >
                {payment.status.replace("_", " ")}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">
                Decline Type
              </span>
              <span className="text-sm capitalize">
                {payment.declineType.replace("_", " ")}
              </span>
            </div>
            {payment.failureReason && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Reason</span>
                <span className="text-sm">{payment.failureReason}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Created</span>
              <span className="text-sm">
                {new Date(payment.createdAt).toLocaleDateString()}
              </span>
            </div>
            {payment.recoveredAt && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">
                  Recovered
                </span>
                <span className="text-sm">
                  {new Date(payment.recoveredAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dunning Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <PaymentTimeline jobs={jobs} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
