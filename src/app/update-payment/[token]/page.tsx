import type { Metadata } from "next";
import { getPaymentDetails } from "@/app/actions/update-payment";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";
import PaymentForm from "./PaymentForm";

export const metadata: Metadata = {
  robots: "noindex",
};

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount / 100);
}

export default async function UpdatePaymentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await getPaymentDetails(token);

  if (!result.success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Link Expired</CardTitle>
              <CardDescription>
                This payment update link has expired or is no longer valid.
                Please contact the merchant for a new link.
              </CardDescription>
            </CardHeader>
            <CardFooter className="justify-center">
              <p className="text-xs text-muted-foreground">
                Secure page powered by ChurnGuard
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  const { amount, currency, companyName, logoUrl, brandColor } = result.data;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={companyName}
                  className="max-h-12 object-contain"
                />
              ) : (
                <h2 className="text-lg font-semibold">{companyName}</h2>
              )}
            </div>
            <CardTitle className="text-xl">Update Payment Method</CardTitle>
            <CardDescription>
              Update your card to pay{" "}
              <span className="font-semibold text-foreground">
                {formatAmount(amount, currency)}
              </span>{" "}
              and restore your subscription.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PaymentForm token={token} brandColor={brandColor} />
          </CardContent>
          <CardFooter className="justify-center">
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5" />
              Secure page powered by ChurnGuard
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
