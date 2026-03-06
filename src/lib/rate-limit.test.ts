import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockExec, mockPipeline } = vi.hoisted(() => {
  const mockExec = vi.fn();
  const mockPipeline = vi.fn().mockReturnValue({
    incr: vi.fn(),
    expire: vi.fn(),
    exec: mockExec,
  });
  return { mockExec, mockPipeline };
});

vi.mock("@vercel/kv", () => ({
  kv: { pipeline: mockPipeline },
}));

import { checkRateLimit } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows requests under both limits", async () => {
    mockExec.mockResolvedValue([500, 1, 5000, 1]);

    const result = await checkRateLimit("org-1");
    expect(result.allowed).toBe(true);
    expect(result.retryAfter).toBeUndefined();
  });

  it("blocks when minute limit exceeded", async () => {
    mockExec.mockResolvedValue([1001, 1, 5000, 1]);

    const result = await checkRateLimit("org-1");
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
    expect(result.retryAfter).toBeLessThanOrEqual(60);
  });

  it("blocks when hour limit exceeded", async () => {
    mockExec.mockResolvedValue([500, 1, 10001, 1]);

    const result = await checkRateLimit("org-1");
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
    expect(result.retryAfter).toBeLessThanOrEqual(3600);
  });

  it("fails open when KV throws an error", async () => {
    mockExec.mockRejectedValue(new Error("KV unavailable"));

    const result = await checkRateLimit("org-1");
    expect(result.allowed).toBe(true);
  });

  it("creates pipeline with correct key structure", async () => {
    mockExec.mockResolvedValue([1, 1, 1, 1]);

    await checkRateLimit("my-org");
    expect(mockPipeline).toHaveBeenCalledOnce();
  });
});
