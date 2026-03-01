import { db } from "@/db";
import { dunningJobs } from "@/db/schema";
import type { FailedPayment, DeclineType } from "@/types";

interface ScheduleConfig {
  dayOffset: number;
  jobType: "email" | "retry";
}

const SOFT_DECLINE_SCHEDULE: ScheduleConfig[] = [
  { dayOffset: 0, jobType: "email" },   // Day 0: immediate friendly email
  { dayOffset: 3, jobType: "retry" },    // Day 3: retry payment
  { dayOffset: 3, jobType: "email" },    // Day 3: follow-up email
  { dayOffset: 7, jobType: "email" },    // Day 7: urgency email
  { dayOffset: 10, jobType: "email" },   // Day 10: final warning
];

const HARD_DECLINE_SCHEDULE: ScheduleConfig[] = [
  { dayOffset: 0, jobType: "email" },   // Single email: request new card
];

const SCA_SCHEDULE: ScheduleConfig[] = [
  { dayOffset: 0, jobType: "email" },   // Immediate: authentication needed
  { dayOffset: 3, jobType: "email" },   // Reminder to authenticate
];

function getSchedule(declineType: DeclineType): ScheduleConfig[] {
  switch (declineType) {
    case "hard":
      return HARD_DECLINE_SCHEDULE;
    case "sca_required":
      return SCA_SCHEDULE;
    default:
      return SOFT_DECLINE_SCHEDULE;
  }
}

/**
 * Schedule all dunning jobs for a failed payment based on its decline type.
 * Soft declines: 4 emails + 1 retry over 10 days.
 * Hard declines: 1 email (request new card).
 * SCA: 2 emails (authenticate).
 */
export async function scheduleDunningJobs(
  payment: FailedPayment
): Promise<void> {
  const schedule = getSchedule(payment.declineType);
  const now = new Date();

  const jobs = schedule.map((config, index) => ({
    failedPaymentId: payment.id,
    organizationId: payment.organizationId,
    jobType: config.jobType as "email" | "retry",
    scheduledAt: new Date(
      now.getTime() + config.dayOffset * 24 * 60 * 60 * 1000
    ),
    attemptNumber: index,
  }));

  if (jobs.length > 0) {
    await db.insert(dunningJobs).values(jobs);
  }
}
