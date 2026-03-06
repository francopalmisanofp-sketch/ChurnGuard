import { describe, it, expect } from "vitest";
import { getStaticTemplate } from "./templates";
import type { EmailGenerationContext } from "@/types";

function makeCtx(
  overrides: Partial<EmailGenerationContext> = {}
): EmailGenerationContext {
  return {
    customerName: "Alice",
    customerEmail: "alice@example.com",
    amount: 1250,
    currency: "usd",
    companyName: "Acme Inc",
    attemptNumber: 0,
    declineType: "soft",
    updatePaymentUrl: "https://example.com/update",
    ...overrides,
  };
}

describe("getStaticTemplate", () => {
  describe("soft decline sequence", () => {
    it("returns day 0 template for attempt 0", () => {
      const result = getStaticTemplate(makeCtx({ attemptNumber: 0 }));
      expect(result.subject).toContain("$12.50");
      expect(result.subject).toContain("didn't go through");
      expect(result.body).toContain("Alice");
    });

    it("returns day 3 template for attempt 1", () => {
      const result = getStaticTemplate(makeCtx({ attemptNumber: 1 }));
      expect(result.subject).toContain("Quick reminder");
      expect(result.subject).toContain("$12.50");
    });

    it("returns day 7 template for attempt 2", () => {
      const result = getStaticTemplate(makeCtx({ attemptNumber: 2 }));
      expect(result.subject).toContain("access will be paused");
      expect(result.body).toContain("Acme Inc");
    });

    it("returns day 10 template for attempt 3", () => {
      const result = getStaticTemplate(makeCtx({ attemptNumber: 3 }));
      expect(result.subject).toContain("Final notice");
    });

    it("returns day 10 template for attempt > 3", () => {
      const result = getStaticTemplate(makeCtx({ attemptNumber: 5 }));
      expect(result.subject).toContain("Final notice");
    });
  });

  describe("hard decline", () => {
    it("returns hard decline template", () => {
      const result = getStaticTemplate(makeCtx({ declineType: "hard" }));
      expect(result.subject).toContain("card was declined");
      expect(result.body).toContain("new payment method");
    });
  });

  describe("SCA required", () => {
    it("returns SCA template", () => {
      const result = getStaticTemplate(makeCtx({ declineType: "sca_required" }));
      expect(result.subject).toContain("Authentication required");
      expect(result.body).toContain("additional verification");
    });
  });

  describe("amount formatting", () => {
    it("formats $12.50 correctly", () => {
      const result = getStaticTemplate(makeCtx({ amount: 1250 }));
      expect(result.subject).toContain("$12.50");
    });

    it("formats $100.00 correctly", () => {
      const result = getStaticTemplate(makeCtx({ amount: 10000 }));
      expect(result.subject).toContain("$100.00");
    });
  });

  describe("customer name handling", () => {
    it("includes customer name when present", () => {
      const result = getStaticTemplate(makeCtx({ customerName: "Bob" }));
      expect(result.body).toContain("Hi Bob");
    });

    it("omits name when empty string", () => {
      const result = getStaticTemplate(makeCtx({ customerName: "" }));
      expect(result.body).toMatch(/^Hi,/);
    });
  });

  describe("template content", () => {
    it("includes the update payment URL", () => {
      const result = getStaticTemplate(makeCtx());
      expect(result.body).toContain("https://example.com/update");
    });

    it("includes company name in body", () => {
      const result = getStaticTemplate(makeCtx({ companyName: "TestCo" }));
      expect(result.body).toContain("TestCo");
    });
  });
});
