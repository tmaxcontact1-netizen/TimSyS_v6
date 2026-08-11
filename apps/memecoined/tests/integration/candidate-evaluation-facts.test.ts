import { describe, expect, it } from "vitest";

import type { CandidateEvaluationLease } from "../../src/application/ports/repositories.js";
import { LiveCandidateEvaluationFactSource } from "../../src/application/services/live-candidate-evaluation-facts.js";
import { PostgresCandidateWalletPurchaseSource } from "../../src/infrastructure/database/candidate-wallet-confirmations.js";
import {
  asNonNegativeDecimal,
  asTimestamp,
  asUuid,
  type CandidateId,
  type EvidenceId,
} from "../../src/domain/shared/types.js";
import { asMintAddress } from "../../src/domain/token/token.js";

const now = asTimestamp("2026-08-05T00:10:00Z");
const candidateId = asUuid<CandidateId>("00000000-0000-4000-8000-000000002101");
const lease: CandidateEvaluationLease = {
  candidateId,
  mint: asMintAddress("So11111111111111111111111111111111111111112"),
  evaluationRunId: "candidate-evaluation:test:1",
  leaseOwner: "worker",
  failedAttempts: 0,
};
const trace = {
  evidenceId: asUuid<EvidenceId>("00000000-0000-4000-8000-000000002102"),
  provider: "dexscreener" as const,
  method: "test",
  requestedAt: now,
  respondedAt: now,
  sourceTimestamp: null,
  normalizedAt: now,
  sourceKey: "market",
  contentHash: "hash",
};

describe("candidate evaluation fact reconstruction", () => {
  it("excludes Tier B purchases whose independence authority is absent", async () => {
    const queries: string[] = [];
    const source = new PostgresCandidateWalletPurchaseSource({
      connect: async () => ({
        query: async (sql: string) => (queries.push(sql), { rows: [], rowCount: 0 }),
        release: () => undefined,
      }),
    } as never);
    await expect(source.load(candidateId)).resolves.toEqual([]);
    expect(queries[0]).toContain("w.independent_group_id IS NOT NULL");
  });

  it("binds live market and security to reconstructed confirmation evidence", async () => {
    const confirmations: unknown[] = [];
    const facts = await new LiveCandidateEvaluationFactSource(
      {
        observePrimaryPool: async () => ({
          ok: true,
          value: {
            mint: lease.mint,
            quoteMint: "So11111111111111111111111111111111111111112",
            pairCreatedAt: asTimestamp("2026-08-04T23:00:00Z"),
            priceUsd: asNonNegativeDecimal("1"),
            liquidityUsd: asNonNegativeDecimal("100000"),
            marketCapitalizationUsd: asNonNegativeDecimal("1000000"),
            fiveMinuteVolumeUsd: asNonNegativeDecimal("25000"),
            fiveMinuteBuys: 30n,
            fiveMinuteSells: 10n,
            fiveMinutePriceChangePercentage: asNonNegativeDecimal("5"),
            trace,
          } as never,
        }),
      },
      {
        observe: async () => ({ observedAt: now, evidence: [trace], holders: null }) as never,
      },
      { load: async () => [] },
      {
        saveQualification: async () => undefined,
        saveConfirmation: async (value) => {
          confirmations.push(value);
        },
      },
      () => now,
    ).load(lease);
    expect(facts.walletConfirmation).toBe("none");
    expect(facts.market.quoteAsset).toBe("SOL");
    expect(facts.market.poolAgeMinutes?.toString()).toBe("70");
    expect(confirmations).toHaveLength(1);
  });

  it("fails before creating a negative decision when market authority is unavailable", async () => {
    const source = new LiveCandidateEvaluationFactSource(
      { observePrimaryPool: async () => ({ ok: false, error: { code: "unavailable" } }) as never },
      { observe: async () => ({}) as never },
      { load: async () => [] },
      { saveQualification: async () => undefined, saveConfirmation: async () => undefined },
      () => now,
    );
    await expect(source.load(lease)).rejects.toThrow(/market evidence unavailable/);
  });
});
