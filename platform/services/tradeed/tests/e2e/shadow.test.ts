import { describe, expect, it, vi } from "vitest";
import { runLeasedCandidateEvaluationCycle } from "../../src/application/services/candidate-evaluation-work.js";
import {
  asPercentage,
  asTimestamp,
  asUuid,
  type CandidateId,
  type EvidenceId,
  type SignalId,
} from "../../src/domain/shared/types.js";
import { asMintAddress } from "../../src/domain/token/token.js";
const at = asTimestamp("2026-08-26T12:05:00Z"),
  candidateId = asUuid<CandidateId>("00000000-0000-4000-8000-000000000121"),
  mint = asMintAddress("So11111111111111111111111111111111111111112"),
  lease = {
    candidateId,
    mint,
    evaluationRunId: "shadow-run-1",
    leaseOwner: "shadow",
    failedAttempts: 0,
  };
const evidence = [
  {
    id: asUuid<EvidenceId>("00000000-0000-4000-8000-000000000122"),
    provider: "solana_rpc" as const,
    observedAt: at,
    sourceKey: "shadow",
  },
];
const facts = {
  evaluatedAt: at,
  walletConfirmation: "none" as const,
  security: {
    observedAt: at,
    evidence,
    directlyVerifiedOnChain: true,
    program: "spl_token" as const,
    mintAuthority: "revoked" as const,
    freezeAuthority: "revoked" as const,
    extensions: [],
    extensionsVerified: true,
    holders: {
      topTenNormalPercentage: asPercentage(10),
      largestNormalPercentage: asPercentage(2),
      exclusionsVerified: true,
    },
  },
  market: {
    observedAt: at,
    evidence,
    chain: "solana" as const,
    quoteAsset: "SOL" as const,
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
};
describe("shadow promotion journey", () => {
  it("persists a deterministic decision but never constructs execution", async () => {
    const saveEvaluation = vi.fn(),
      retry = vi.fn();
    const completed = await runLeasedCandidateEvaluationCycle({
      queue: { claim: async () => [lease], retry },
      facts: { load: async () => facts },
      repository: { saveEvaluation },
      ownerId: "shadow",
      now: () => at,
      leaseExpiresAt: () => at,
      retryAt: () => at,
      signalId: () => asUuid<SignalId>("00000000-0000-4000-8000-000000000123"),
    });
    expect(completed).toBe(1);
    expect(saveEvaluation).toHaveBeenCalledOnce();
    expect(saveEvaluation.mock.calls[0]?.[0]).not.toHaveProperty("signedTransaction");
    expect(retry).not.toHaveBeenCalled();
  });
  it("returns stale evidence to the queue without manufacturing a decision", async () => {
    const saveEvaluation = vi.fn(),
      retry = vi.fn();
    const completed = await runLeasedCandidateEvaluationCycle({
      queue: { claim: async () => [lease], retry },
      facts: { load: async () => Promise.reject(new Error("market evidence stale")) },
      repository: { saveEvaluation },
      ownerId: "shadow",
      now: () => at,
      leaseExpiresAt: () => at,
      retryAt: () => at,
      signalId: () => asUuid<SignalId>("00000000-0000-4000-8000-000000000123"),
    });
    expect(completed).toBe(0);
    expect(saveEvaluation).not.toHaveBeenCalled();
    expect(retry).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "market evidence stale" }),
    );
  });
});
