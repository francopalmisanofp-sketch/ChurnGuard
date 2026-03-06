import { describe, it, expect } from "vitest";
import { classifyDecline } from "./decline-classifier";

describe("classifyDecline", () => {
  describe("hard decline codes", () => {
    const hardCodes = [
      "stolen_card",
      "lost_card",
      "card_not_supported",
      "invalid_account",
      "account_closed",
      "pickup_card",
      "restricted_card",
      "security_violation",
      "fraudulent",
      "invalid_number",
    ];

    it.each(hardCodes)("classifies %s as hard", (code) => {
      expect(classifyDecline(code, null)).toBe("hard");
    });
  });

  describe("SCA codes", () => {
    it("classifies authentication_required as sca_required", () => {
      expect(classifyDecline("authentication_required", null)).toBe("sca_required");
    });

    it("classifies card_declined_rate_limit_or_authentication_required as sca_required", () => {
      expect(
        classifyDecline("card_declined_rate_limit_or_authentication_required", null)
      ).toBe("sca_required");
    });
  });

  describe("soft decline codes", () => {
    it("classifies insufficient_funds as soft", () => {
      expect(classifyDecline("insufficient_funds", null)).toBe("soft");
    });

    it("classifies processing_error as soft", () => {
      expect(classifyDecline("processing_error", null)).toBe("soft");
    });

    it("classifies generic_decline as soft", () => {
      expect(classifyDecline("generic_decline", null)).toBe("soft");
    });
  });

  describe("null/undefined code handling", () => {
    it("returns soft for null code and null message", () => {
      expect(classifyDecline(null, null)).toBe("soft");
    });

    it("returns soft for undefined code", () => {
      expect(classifyDecline(undefined, undefined)).toBe("soft");
    });

    it("returns sca_required when message contains authentication", () => {
      expect(classifyDecline(null, "Your bank requires authentication")).toBe(
        "sca_required"
      );
    });

    it("returns sca_required case-insensitively for authentication message", () => {
      expect(classifyDecline(null, "AUTHENTICATION needed")).toBe("sca_required");
    });

    it("returns soft when message has no auth keywords", () => {
      expect(classifyDecline(null, "Something went wrong")).toBe("soft");
    });
  });
});
