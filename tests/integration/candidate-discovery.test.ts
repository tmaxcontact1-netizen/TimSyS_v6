import { describe, expect, it } from "vitest";

import type { CandidateDiscoveryRepository } from "../../src/application/ports/repositories.js";
import {
  candidateDeduplicationKey,
  discoverCandidate,
  type CandidateDiscoveryHint,
} from "../../src/application/services/discovery.js";
import type { DiscoveredCandidateInput } from "../../src/domain/candidate/model.js";
import { asStrategyVersionId, asTimestamp, asUuid } from "../../src/domain/shared/types.js";
import type {
  CandidateId,
  EvidenceId,
  MintAddress,
  TokenId,
} from "../../src/domain/shared/types.js";
import { PostgresCandidateDiscoveryRepository } from "../../src/infrastructure/database/candidate-discovery.js";
import { runDiscoveryWorkerCycle } from "../../src/workers/discovery-worker.js";

const candidateId = asUuid<CandidateId>("00000000-0000-4000-8000-000000000601");
const tokenId = asUuid<TokenId>("00000000-0000-4000-8000-000000000602");
const evidenceId = asUuid<EvidenceId>("00000000-0000-4000-8000-000000000603");
const observedAt = asTimestamp("2026-08-04T18:00:00Z");
const mint = "So11111111111111111111111111111111111111112" as MintAddress;

function hint(overrides: Partial<CandidateDiscoveryHint> = {}): CandidateDiscoveryHint {
  return Object.freeze({
    candidateId,
    tokenId,
    mint,
    strategyVersionId: asStrategyVersionId("strategy-v1.0.0"),
    deduplicationWindow: "2026-08-04T18:00Z",
    discoveredAt: observedAt,
    source: Object.freeze({
      provider: "dexscreener" as const,
      sourceReference: "pair:alpha",
      observedAt,
      evidenceId,
    }),
    ...overrides,
  });
}

describe("candidate discovery", () => {
  it("derives a stable mint, strategy, and window identity", () => {
    expect(
      candidateDeduplicationKey({
        mint,
        strategyVersionId: asStrategyVersionId("strategy-v1.0.0"),
        window: "window-1",
      }),
    ).toBe(`strategy-v1.0.0:${mint}:window-1`);
  });

  it("rejects future provenance before persistence", async () => {
    const repository: CandidateDiscoveryRepository = {
      recordDiscovery: async () => Promise.reject(new Error("not expected")),
    };
    await expect(
      discoverCandidate(
        hint({
          source: Object.freeze({
            ...hint().source,
            observedAt: asTimestamp("2026-08-04T18:00:01Z"),
          }),
        }),
        repository,
      ),
    ).rejects.toThrow("future");
  });

  it("processes a bounded batch serially and reports durable outcomes", async () => {
    const calls: string[] = [];
    const repository: CandidateDiscoveryRepository = {
      recordDiscovery: async (input: DiscoveredCandidateInput) => {
        calls.push(input.source.sourceReference);
        return Object.freeze({ candidate: input, candidateCreated: true, sourceAdded: true });
      },
    };
    const result = await runDiscoveryWorkerCycle({
      source: {
        nextBatch: async () =>
          Object.freeze([
            hint(),
            hint({
              candidateId: asUuid<CandidateId>("00000000-0000-4000-8000-000000000604"),
              source: Object.freeze({ ...hint().source, sourceReference: "pair:beta" }),
            }),
          ]),
      },
      candidates: repository,
      batchSize: 2,
    });
    expect(calls).toEqual(["pair:alpha", "pair:beta"]);
    expect(result).toMatchObject({ hintsVisited: 2, candidatesCreated: 2, sourcesAdded: 2 });
  });

  it("commits candidate, provenance, and one evaluation job atomically", async () => {
    const queries: string[] = [];
    const client = fakeClient(queries);
    const repository = new PostgresCandidateDiscoveryRepository({ connect: async () => client });
    const result = await discoverCandidate(hint(), repository);
    expect(result).toMatchObject({ candidateCreated: true, sourceAdded: true });
    expect(queries.some((query) => query.includes("candidate_evaluation"))).toBe(true);
    expect(queries.at(-1)).toBe("COMMIT");
  });

  it("rolls back when atomic scheduling fails", async () => {
    const queries: string[] = [];
    const client = fakeClient(queries, true);
    const repository = new PostgresCandidateDiscoveryRepository({ connect: async () => client });
    await expect(discoverCandidate(hint(), repository)).rejects.toThrow("job failed");
    expect(queries.at(-1)).toBe("ROLLBACK");
  });
});

function fakeClient(queries: string[], failJob = false) {
  return {
    query: async (text: string) => {
      queries.push(text);
      if (text.includes("RETURNING id"))
        return {
          rowCount: 1,
          rows: [
            {
              id: candidateId,
              token_id: tokenId,
              mint_address: mint,
              active_dedup_key: `strategy-v1.0.0:${mint}:2026-08-04T18:00Z`,
              state: "discovered",
              first_seen_at: observedAt,
              strategy_version_id: "strategy-v1.0.0",
            },
          ],
        };
      if (failJob && text.includes("candidate_evaluation")) throw new Error("job failed");
      return { rowCount: 1, rows: [] };
    },
    release: () => undefined,
  } as never;
}
