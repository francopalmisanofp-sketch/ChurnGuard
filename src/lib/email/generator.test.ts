import { describe, it, expect, vi, beforeEach } from "vitest";
import type { EmailGenerationContext } from "@/types";

const { mockCreate } = vi.hoisted(() => {
  const mockCreate = vi.fn();
  return { mockCreate };
});

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
  },
}));

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

describe("generateDunningEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns static template when ANTHROPIC_API_KEY is missing", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");

    const { generateDunningEmail } = await import("./generator");
    const result = await generateDunningEmail(makeCtx());

    expect(result.subject).toBeTruthy();
    expect(result.body).toBeTruthy();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns AI-generated email on success", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");

    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            subject: "AI Subject",
            body: "AI Body",
          }),
        },
      ],
    });

    const { generateDunningEmail } = await import("./generator");
    const result = await generateDunningEmail(makeCtx());

    expect(result.subject).toBe("AI Subject");
    expect(result.body).toBe("AI Body");
  });

  it("falls back to static template on API error", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");

    mockCreate.mockRejectedValue(new Error("API down"));

    const { generateDunningEmail } = await import("./generator");
    const result = await generateDunningEmail(makeCtx());

    expect(result.subject).toBeTruthy();
    expect(result.body).toBeTruthy();
  });

  it("falls back to static template on invalid JSON", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");

    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "not valid json" }],
    });

    const { generateDunningEmail } = await import("./generator");
    const result = await generateDunningEmail(makeCtx());

    expect(result.subject).toBeTruthy();
    expect(result.body).toBeTruthy();
  });
});
