import { describe, expect, it, vi } from "vitest";
import { runScheduledAcquisitionCycle } from "../../src/application/services/acquisition-schedule.js";
import { asTimestamp } from "../../src/domain/shared/types.js";
import { PostgresAcquisitionSchedule } from "../../src/infrastructure/database/acquisition-schedule.js";

const at = asTimestamp("2026-08-26T16:00:00.000Z"),
  later = (ms: number) => asTimestamp(new Date(Date.parse(at) + ms));
function input(overrides: Record<string, unknown> = {}) {
  return {
    schedule: {
      claim: async () => ({ ownerId: "one", startedAt: at }),
      complete: vi.fn(),
      retry: vi.fn(),
    },
    ownerId: "one",
    now: () => at,
    leaseExpiresAt: () => later(180000),
    nextAvailableAt: () => later(30000),
    retryAt: () => later(10000),
    discover: async () => ({ candidatesCreated: 2, sourcesAdded: 2 }),
    observeWallets: async () => undefined,
    valueWallets: async () => undefined,
    evaluateCandidates: async () => 2,
    publishPortfolioAndEvaluateRisk: async () => 1,
    ...overrides,
  };
}
describe("scheduled candidate acquisition", () => {
  it("runs the dependency chain once under one lease", async () => {
    const order: string[] = [],
      complete = vi.fn();
    const result = await runScheduledAcquisitionCycle(
      input({
        schedule: {
          claim: async () => ({ ownerId: "one", startedAt: at }),
          complete,
          retry: vi.fn(),
        },
        discover: async () => {
          order.push("discovery");
          return { candidatesCreated: 2, sourcesAdded: 2 };
        },
        observeWallets: async () => void order.push("observations"),
        valueWallets: async () => void order.push("valuations"),
        evaluateCandidates: async () => {
          order.push("candidates");
          return 2;
        },
        publishPortfolioAndEvaluateRisk: async () => {
          order.push("risk");
          return 1;
        },
      }),
    );
    expect(order).toEqual(["discovery", "observations", "valuations", "candidates", "risk"]);
    expect(result).toMatchObject({
      status: "completed",
      summary: { discovered: 2, candidatesEvaluated: 2, riskEvaluated: 1 },
    });
    expect(complete).toHaveBeenCalledOnce();
  });
  it("does no provider work when another process owns the lease", async () => {
    const discover = vi.fn();
    const result = await runScheduledAcquisitionCycle(
      input({ schedule: { claim: async () => null, complete: vi.fn(), retry: vi.fn() }, discover }),
    );
    expect(result.status).toBe("locked");
    expect(discover).not.toHaveBeenCalled();
  });
  it("records the exact failed stage and defers downstream work", async () => {
    const risk = vi.fn(),
      retry = vi.fn();
    const result = await runScheduledAcquisitionCycle(
      input({
        schedule: {
          claim: async () => ({ ownerId: "one", startedAt: at }),
          complete: vi.fn(),
          retry,
        },
        valueWallets: async () => Promise.reject(new Error("market stale")),
        publishPortfolioAndEvaluateRisk: risk,
      }),
    );
    expect(result).toMatchObject({ status: "retry_scheduled", failedStage: "wallet_valuation" });
    expect(risk).not.toHaveBeenCalled();
    expect(retry).toHaveBeenCalledWith(
      expect.objectContaining({ failedStage: "wallet_valuation", reason: "market stale" }),
    );
  });
  it("fences a delayed release after lease expiry or restart", async () => {
    const queries: string[] = [];
    const schedule = new PostgresAcquisitionSchedule({
      connect: async () => ({
        query: async (text: string) => {
          queries.push(text);
          return { rowCount: 0, rows: [] };
        },
        release: () => undefined,
      }),
    } as never);
    await expect(
      schedule.complete({
        lease: { ownerId: "same", startedAt: at },
        availableAt: later(30000),
        summary: { discovered: 0, sourcesAdded: 0, candidatesEvaluated: 0, riskEvaluated: 0 },
      }),
    ).rejects.toThrow("active lease");
    expect(queries[0]).toContain("updated_at=$7");
  });
});
