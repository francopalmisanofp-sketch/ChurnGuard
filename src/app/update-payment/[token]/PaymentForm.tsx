"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import {
  createSetupIntent,
  confirmAndRetryInvoice,
} from "@/app/actions/update-payment";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

function CheckoutForm({
  token,
  brandColor,
}: {
  token: string;
  brandColor: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message ?? "Please check your card details.");
      setLoading(false);
      return;
    }

    const result = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
    });

    if (result.error) {
      setError(result.error.message ?? "Card verification failed.");
      setLoading(false);
      return;
    }

    const setupIntent = result.setupIntent;
    const retryResult = await confirmAndRetryInvoice(token, setupIntent.id);

    if (retryResult.success) {
      router.push(`/update-payment/${token}/success`);
    } else {
      setError(retryResult.message);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={!stripe || !elements || loading}
        style={{ backgroundColor: brandColor }}
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Processing...
          </>
        ) : (
          "Update card and pay"
        )}
      </Button>
    </form>
  );
}

export default function PaymentForm({
  token,
  brandColor,
}: {
  token: string;
  brandColor: string;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createSetupIntent(token).then((result) => {
      if (result.error) {
        setError(result.error);
      } else {
        setClientSecret(result.clientSecret!);
      }
    });
  }, [token]);

  if (error) {
    return (
      <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: { colorPrimary: brandColor },
        },
      }}
    >
      <CheckoutForm token={token} brandColor={brandColor} />
    </Elements>
  );
}
