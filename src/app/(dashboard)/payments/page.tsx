import { PaymentsTable } from "@/components/dashboard/payments-table";
import { getPayments } from "@/app/actions/payments";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PaymentStatus } from "@/types";

export const metadata = { title: "Payments" };

interface PaymentsPageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  const params = await searchParams;
  const status = params.status as PaymentStatus | undefined;
  const page = parseInt(params.page ?? "1", 10);

  const { payments, total } = await getPayments(status, page, 20);
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Failed Payments</h1>
        <p className="text-sm text-muted-foreground">
          {total} total payments tracked
        </p>
      </div>
      <Tabs defaultValue={status ?? "all"}>
        <TabsList>
          <TabsTrigger value="all" asChild>
            <a href="/dashboard/payments">All</a>
          </TabsTrigger>
          <TabsTrigger value="in_dunning" asChild>
            <a href="/dashboard/payments?status=in_dunning">In Dunning</a>
          </TabsTrigger>
          <TabsTrigger value="recovered" asChild>
            <a href="/dashboard/payments?status=recovered">Recovered</a>
          </TabsTrigger>
          <TabsTrigger value="hard_churn" asChild>
            <a href="/dashboard/payments?status=hard_churn">Churned</a>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <PaymentsTable payments={payments} />
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          {page > 1 && (
            <a
              href={`/dashboard/payments?${status ? `status=${status}&` : ""}page=${page - 1}`}
              className="text-primary hover:underline"
            >
              Previous
            </a>
          )}
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <a
              href={`/dashboard/payments?${status ? `status=${status}&` : ""}page=${page + 1}`}
              className="text-primary hover:underline"
            >
              Next
            </a>
          )}
        </div>
      )}
    </div>
  );
}
