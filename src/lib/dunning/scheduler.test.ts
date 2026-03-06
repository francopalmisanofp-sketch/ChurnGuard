import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FailedPayment } from "@/types";

const { mockValues, mockInsert } = vi.hoisted(() => {
  const mockValues = vi.fn().mockReturnThis();
  const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
  return { mockValues, mockInsert };
});

vi.mock("@/db", () => ({
  db: { insert: mockInsert },
}));

vi.mock("@/db/schema", () => ({
  dunningJobs: Symbol("dunningJobs"),
}));

import { scheduleDunningJobs } from "./scheduler";

function makePayment(
  overrides: Partial<FailedPayment> = {}
): FailedPayment {
  return {
    id: "fp-1",
    organizationId: "org-1",
    stripeInvoiceId: "inv_1",
    stripeCustomerId: "cus_1",
    stripeSubscriptionId: "sub_1",
    customerEmail: "test@example.com",
    customerName: "Test",
    amount: 1000,
    currency: "usd",
    declineCode: null,
    declineType: "soft",
    failureMessage: null,
    status: "pending",
    dunningStep: 0,
    recoveredAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as FailedPayment;
}

describe("scheduleDunningJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates 5 jobs for soft decline", async () => {
    await scheduleDunningJobs(makePayment({ declineType: "soft" }));

    expect(mockInsert).toHaveBeenCalledOnce();
    const jobs = mockValues.mock.calls[0][0];
    expect(jobs).toHaveLength(5);
  });

  it("creates 1 job for hard decline", async () => {
    await scheduleDunningJobs(makePayment({ declineType: "hard" }));

    const jobs = mockValues.mock.calls[0][0];
    expect(jobs).toHaveLength(1);
    expect(jobs[0].jobType).toBe("email");
  });

  it("creates 2 jobs for SCA decline", async () => {
    await scheduleDunningJobs(makePayment({ declineType: "sca_required" }));

    const jobs = mockValues.mock.calls[0][0];
    expect(jobs).toHaveLength(2);
    expect(jobs[0].jobType).toBe("email");
    expect(jobs[1].jobType).toBe("email");
  });

  it("assigns correct attemptNumbers (0-indexed)", async () => {
    await scheduleDunningJobs(makePayment({ declineType: "soft" }));

    const jobs = mockValues.mock.calls[0][0];
    jobs.forEach((job: { attemptNumber: number }, i: number) => {
      expect(job.attemptNumber).toBe(i);
    });
  });

  it("sets correct organizationId and failedPaymentId", async () => {
    await scheduleDunningJobs(
      makePayment({ id: "fp-99", organizationId: "org-42", declineType: "hard" })
    );

    const jobs = mockValues.mock.calls[0][0];
    expect(jobs[0].failedPaymentId).toBe("fp-99");
    expect(jobs[0].organizationId).toBe("org-42");
  });

  it("schedules soft decline jobs with increasing dates", async () => {
    await scheduleDunningJobs(makePayment({ declineType: "soft" }));

    const jobs = mockValues.mock.calls[0][0] as { scheduledAt: Date }[];
    for (let i = 1; i < jobs.length; i++) {
      expect(jobs[i].scheduledAt.getTime()).toBeGreaterThanOrEqual(
        jobs[i - 1].scheduledAt.getTime()
      );
    }
  });
});
