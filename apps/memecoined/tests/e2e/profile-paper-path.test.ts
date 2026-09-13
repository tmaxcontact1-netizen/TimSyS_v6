import { describe, expect, it, vi } from "vitest";

import { evaluateProfileCandidate } from "../../src/application/services/profile-paper-simulation.js";
import {
  PaperQuoteExecutionService,
  runPaperEntryExecutionCycle,
} from "../../src/application/services/paper-execution.js";
import { evaluateCandidate } from "../../src/domain/candidate/evaluator.js";
import { tradingProfile } from "../../src/domain/strategy/profiles.js";
import { createExecutableQuote } from "../../src/domain/trading/quote.js";
import {
  asBasisPoints,
  asDecimal,
  asPercentage,
  asRawAmount,
  asTimestamp,
  asUuid,
  type EvidenceId,
} from "../../src/domain/shared/types.js";
import { asMintAddress } from "../../src/domain/token/token.js";

const at = asTimestamp("2026-09-13T01:00:00Z");
const sol = asMintAddress("So11111111111111111111111111111111111111112");
const token = asMintAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const evidence = [
  {
    id: asUuid<EvidenceId>("00000000-0000-4000-8000-000000009901"),
    provider: "dexscreener" as const,
    observedAt: at,
    sourceKey: "complete-live-shaped-evidence",
  },
];

describe("complete candidate-to-paper-fill path", () => {
  it("qualifies complete evidence and records a simulated fill without weakening safety gates", async () => {
    const decision = evaluateCandidate({
      evaluatedAt: at,
      walletConfirmation: "tier_a",
      security: {
        observedAt: at,
        evidence,
        directlyVerifiedOnChain: true,
        program: "spl_token",
        mintAuthority: "revoked",
        freezeAuthority: "revoked",
        extensions: [],
        extensionsVerified: true,
        holders: {
          topTenNormalPercentage: asPercentage(20),
          largestNormalPercentage: asPercentage(5),
          exclusionsVerified: true,
        },
      },
      market: {
        observedAt: at,
        evidence,
        chain: "solana",
        quoteAsset: "SOL",
        poolAgeMinutes: asDecimal(120),
        marketCapitalizationUsd: asDecimal(1_000_000),
        liquidityUsd: asDecimal(200_000),
        liquidityUsdFifteenMinutesAgo: asDecimal(200_000),
        fiveMinutePriceChange: asPercentage(6),
        oneHourPriceChange: asPercentage(15),
        fiveMinuteVolumeUsd: asDecimal(30_000),
        precedingOneHourVolumeUsd: asDecimal(100_000),
        fiveMinuteBuyTransactions: 60n,
        fiveMinuteSellTransactions: 20n,
        fiveMinuteUniqueBuyers: 35n,
        largestBuyerVolumePercentage: asPercentage(10),
        currentExecutablePriceUsd: asDecimal("1.02"),
        fiveMinuteExecutableHighUsd: asDecimal("1.05"),
        confirmingWalletVolumeWeightedEntryUsd: asDecimal("0.95"),
      },
    });
    expect(decision.eligible).toBe(true);
    expect(decision.score.total).toBe(90);
    expect(
      evaluateProfileCandidate(tradingProfile("fast_furious")!, decision.score, []).eligible,
    ).toBe(true);

    const quote = createExecutableQuote({
      fingerprint: "complete-paper-path",
      inputMint: sol,
      outputMint: token,
      inputAmount: asRawAmount(25n),
      expectedOutputAmount: asRawAmount(1000n),
      minimumOutputAmount: asRawAmount(950n),
      slippageBasisPoints: asBasisPoints(150n),
      priceImpactPercentage: asPercentage("0.1"),
      routePlan: ["route"],
      contextSlot: null,
      requestedAt: at,
      receivedAt: at,
      evidence,
    });
    const recordFill = vi.fn();
    const complete = vi.fn();
    const execution = new PaperQuoteExecutionService(
      "paper-wallet" as never,
      { quote: async () => ({ ok: true, value: quote }) },
      { recordFill },
      () => at,
    );
    const fills = await runPaperEntryExecutionCycle({
      queue: {
        claim: async () => [
          {
            signalId: "signal",
            riskRunId: "risk",
            tokenMint: token,
            inputAmountRaw: 25n,
            leaseOwner: "paper",
          },
        ],
        complete,
        retry: vi.fn(),
      },
      execution,
      ownerId: "paper",
      now: () => at,
      leaseExpiresAt: () => asTimestamp("2026-09-13T01:01:00Z"),
      retryAt: () => at,
    });
    expect(fills).toHaveLength(1);
    expect(recordFill).toHaveBeenCalledOnce();
    expect(complete).toHaveBeenCalledOnce();
  });
});
