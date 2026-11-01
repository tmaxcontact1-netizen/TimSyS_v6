import { describe, expect, it, vi } from "vitest";
import { LiveCandidateDiscoverySource } from "../../src/application/services/discovery.js";
import { runDiscoveryWorkerCycle } from "../../src/workers/discovery-worker.js";
import {
  asStrategyVersionId,
  asTimestamp,
  asUuid,
  type EvidenceId,
} from "../../src/domain/shared/types.js";
import { asMintAddress } from "../../src/domain/token/token.js";

const at = asTimestamp("2026-08-26T12:00:00Z"),
  mint = asMintAddress("So11111111111111111111111111111111111111112"),
  trace = {
    evidenceId: asUuid<EvidenceId>("00000000-0000-4000-8000-000000000111"),
    provider: "dexscreener" as const,
    method: "GET",
    requestedAt: at,
    respondedAt: at,
    sourceTimestamp: null,
    normalizedAt: at,
    sourceKey: "profile",
    contentHash: "a".repeat(64),
  };
describe("observation promotion journey", () => {
  it("normalizes and persists live discovery without execution authority", async () => {
    const recordDiscovery = vi.fn(async (candidate) => ({
      candidate,
      candidateCreated: true,
      sourceAdded: true,
    }));
    const source = new LiveCandidateDiscoverySource({
      provider: {
        discoverLatestTokens: async () => ({
          ok: true,
          value: [{ mint, sourceReference: "profile", observedAt: at, trace }],
        }),
      },
      strategyVersionId: asStrategyVersionId("strategy-v1.0.0"),
      now: () => at,
      deduplicationWindow: () => "2026-08-26T12:00Z",
    });
    const result = await runDiscoveryWorkerCycle({ source, candidates: { recordDiscovery } });
    expect(result).toMatchObject({ hintsVisited: 1, candidatesCreated: 1, sourcesAdded: 1 });
    expect(recordDiscovery.mock.calls[0]?.[0]).not.toHaveProperty("transaction");
  });
  it("fails closed when the live provider is unavailable", async () => {
    const recordDiscovery = vi.fn();
    const source = new LiveCandidateDiscoverySource({
      provider: {
        discoverLatestTokens: async () => ({
          ok: false,
          error: {
            code: "unavailable",
            provider: "dexscreener",
            occurredAt: at,
            retryable: true,
            reason: "provider unavailable",
          },
        }),
      },
      strategyVersionId: asStrategyVersionId("strategy-v1.0.0"),
      now: () => at,
      deduplicationWindow: () => "window",
    });
    await expect(
      runDiscoveryWorkerCycle({ source, candidates: { recordDiscovery } }),
    ).rejects.toThrow("unavailable");
    expect(recordDiscovery).not.toHaveBeenCalled();
  });
});
