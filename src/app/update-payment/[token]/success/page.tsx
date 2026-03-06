import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle2, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  robots: "noindex",
};

export default function UpdatePaymentSuccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <CheckCircle2 className="size-12 text-green-600" />
            </div>
            <CardTitle className="text-xl">
              Payment processed successfully
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-muted-foreground">
              Your payment method has been updated and your access has been
              restored. You can close this page.
            </p>
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
