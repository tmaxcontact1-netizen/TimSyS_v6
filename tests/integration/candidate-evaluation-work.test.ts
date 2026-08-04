import { describe, expect, it } from "vitest";

import type { CandidateEvaluationLease } from "../../src/application/ports/repositories.js";
import { runLeasedCandidateEvaluationCycle } from "../../src/application/services/candidate-evaluation-work.js";
import {
  asPercentage,
  asTimestamp,
  asUuid,
  type CandidateId,
  type SignalId,
} from "../../src/domain/shared/types.js";
import { asMintAddress } from "../../src/domain/token/token.js";
import { PostgresCandidateEvaluationWorkQueue } from "../../src/infrastructure/database/candidate-evaluation-jobs.js";

const now = asTimestamp("2026-08-04T20:00:00Z");
const candidateId = asUuid<CandidateId>("00000000-0000-4000-8000-000000000801");
const mint = asMintAddress("So11111111111111111111111111111111111111112");
const lease: CandidateEvaluationLease = Object.freeze({
  candidateId,
  mint,
  evaluationRunId: `candidate-evaluation:${candidateId}:1`,
  leaseOwner: "worker-1",
  failedAttempts: 0,
});

function database(rows: readonly Record<string, unknown>[] = [], rowCount = rows.length) {
  const queries: string[] = [];
  return {
    queries,
    port: {
      connect: async () => ({
        query: async (text: string) => {
          queries.push(text);
          return { rows, rowCount };
        },
        release: () => undefined,
      }),
    } as never,
  };
}

describe("candidate evaluation durable work", () => {
  it("claims available work and hydrates canonical candidate identity", async () => {
    const db = database([{ id: candidateId, attempts: 2, mint_address: mint }]);
    const work = await new PostgresCandidateEvaluationWorkQueue(db.port).claim({
      ownerId: "worker-1",
      now,
      leaseExpiresAt: asTimestamp("2026-08-04T20:01:00Z"),
      limit: 10,
    });
    expect(work[0]).toMatchObject({ candidateId, mint, failedAttempts: 2, leaseOwner: "worker-1" });
    expect(work[0]?.evaluationRunId).toBe(`candidate-evaluation:${candidateId}:3`);
    expect(db.queries.at(0)).toBe("BEGIN");
    expect(db.queries.at(-1)).toBe("COMMIT");
  });

  it("rejects invalid ownership and lease bounds before querying", async () => {
    const db = database();
    const queue = new PostgresCandidateEvaluationWorkQueue(db.port);
    await expect(queue.claim({ ownerId: "", now, leaseExpiresAt: now, limit: 1 })).rejects.toThrow(
      "owner",
    );
    await expect(
      queue.claim({ ownerId: "worker", now, leaseExpiresAt: now, limit: 1 }),
    ).rejects.toThrow("future");
    expect(db.queries).toEqual([]);
  });

  it("returns evidence failures to the queue without evaluating incomplete facts", async () => {
    const retried: string[] = [];
    const saved: unknown[] = [];
    const completed = await runLeasedCandidateEvaluationCycle({
      queue: {
        claim: async () => [lease],
        retry: async ({ reason }) => {
          retried.push(reason);
        },
      },
      facts: {
        load: async () => {
          throw new Error("wallet authority unavailable");
        },
      },
      repository: {
        saveEvaluation: async (value) => {
          saved.push(value);
        },
      },
      ownerId: "worker-1",
      now: () => now,
      leaseExpiresAt: () => asTimestamp("2026-08-04T20:01:00Z"),
      retryAt: () => asTimestamp("2026-08-04T20:00:10Z"),
      signalId: () => asUuid<SignalId>("00000000-0000-4000-8000-000000000802"),
    });
    expect(completed).toBe(0);
    expect(retried).toEqual(["wallet authority unavailable"]);
    expect(saved).toEqual([]);
  });

  it("persists fully hydrated work under the active lease", async () => {
    const saved: Array<Record<string, unknown>> = [];
    const completed = await runLeasedCandidateEvaluationCycle({
      queue: { claim: async () => [lease], retry: async () => undefined },
      facts: {
        load: async () => ({
          evaluatedAt: now,
          walletConfirmation: "none",
          security: {
            observedAt: now,
            evidence: [
              {
                id: asUuid("00000000-0000-4000-8000-000000000803"),
                provider: "solana_rpc",
                observedAt: now,
                sourceKey: "security",
              },
            ],
            directlyVerifiedOnChain: true,
            program: "spl_token",
            mintAuthority: "revoked",
            freezeAuthority: "revoked",
            extensions: [],
            extensionsVerified: true,
            holders: {
              topTenNormalPercentage: asPercentage(10),
              largestNormalPercentage: asPercentage(2),
              exclusionsVerified: true,
            },
          },
          market: {
            observedAt: now,
            evidence: [
              {
                id: asUuid("00000000-0000-4000-8000-000000000804"),
                provider: "dexscreener",
                observedAt: now,
                sourceKey: "market",
              },
            ],
            chain: "solana",
            quoteAsset: "SOL",
            poolAgeMinutes: null,
            marketCapitalizationUsd: null,
            liquidityUsd: null,
            liquidityUsdFifteenMinutesAgo: null,
            fiveMinutePriceChange: null,
            oneHourPriceChange: null,
            fiveMinuteVolumeUsd: null,
            precedingOneHourVolumeUsd: null,
            fiveMinuteBuyTransactions: null,
            fiveMinuteSellTransactions: null,
            fiveMinuteUniqueBuyers: null,
            largestBuyerVolumePercentage: null,
            currentExecutablePriceUsd: null,
            fiveMinuteExecutableHighUsd: null,
            confirmingWalletVolumeWeightedEntryUsd: null,
          },
        }),
      },
      repository: {
        saveEvaluation: async (value) => {
          saved.push(value as unknown as Record<string, unknown>);
        },
      },
      ownerId: "worker-1",
      now: () => now,
      leaseExpiresAt: () => asTimestamp("2026-08-04T20:01:00Z"),
      retryAt: () => now,
      signalId: () => asUuid<SignalId>("00000000-0000-4000-8000-000000000805"),
    });
    expect(completed).toBe(1);
    expect(saved[0]?.leaseOwner).toBe("worker-1");
  });
});
