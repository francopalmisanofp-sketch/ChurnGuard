import { Badge } from "@/components/ui/badge";
import type { DunningJob } from "@/types";

function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function jobStatusIcon(status: string): string {
  switch (status) {
    case "done":
      return "bg-green-500";
    case "failed":
      return "bg-red-500";
    case "executing":
      return "bg-yellow-500";
    case "cancelled":
      return "bg-gray-400";
    default:
      return "bg-blue-500";
  }
}

export function PaymentTimeline({ jobs }: { jobs: DunningJob[] }) {
  if (jobs.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No dunning jobs scheduled yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {jobs.map((job, index) => (
        <div key={job.id} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div
              className={`h-3 w-3 rounded-full ${jobStatusIcon(job.status)}`}
            />
            {index < jobs.length - 1 && (
              <div className="w-px flex-1 bg-border" />
            )}
          </div>
          <div className="flex-1 pb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium capitalize">
                {job.jobType}
              </span>
              <Badge variant="outline" className="text-xs">
                {job.status}
              </Badge>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Scheduled: {formatDateTime(job.scheduledAt)}
              {job.executedAt && ` — Executed: ${formatDateTime(job.executedAt)}`}
            </div>
            {job.emailSubject && (
              <div className="mt-1 text-xs">
                Subject: &quot;{job.emailSubject}&quot;
              </div>
            )}
            {job.emailBodyPreview && (
              <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                {job.emailBodyPreview}
              </div>
            )}
            {job.result && (
              <div className="mt-1 text-xs">
                {(job.result as { success: boolean; error?: string }).success
                  ? "Completed successfully"
                  : `Error: ${(job.result as { error?: string }).error ?? "Unknown"}`}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
