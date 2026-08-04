import { describe, expect, it } from "vitest";
import { prepareEntry } from "../../src/application/services/entry-preparation.js";
import type { PersistEntryPreparation } from "../../src/application/ports/repositories.js";
import { PostgresEntryPreparationRepository } from "../../src/infrastructure/database/entry-preparations.js";
import {
  createEntryApproval,
  createEntryGateSnapshot,
  createExecutableQuote,
} from "../../src/domain/trading/quote.js";
import {
  asBasisPoints,
  asNonNegativeDecimal,
  asPercentage,
  asRawAmount,
  asSolanaSlot,
  asTimestamp,
  asUuid,
  type EvidenceId,
  type MintAddress,
  type OrderId,
  type SignalId,
  type WalletAddress,
} from "../../src/domain/shared/types.js";

const at = asTimestamp("2026-08-04T21:00:02Z");
const received = asTimestamp("2026-08-04T21:00:00Z");
const signalId = asUuid<SignalId>("00000000-0000-4000-8000-000000000811");
const orderId = asUuid<OrderId>("00000000-0000-4000-8000-000000000812");
const sol = "So11111111111111111111111111111111111111112" as MintAddress;
const token = "11111111111111111111111111111111" as MintAddress;
const evidence = Object.freeze([
  {
    id: asUuid<EvidenceId>("00000000-0000-4000-8000-000000000813"),
    provider: "jupiter" as const,
    observedAt: received,
    sourceKey: "entry",
    slot: asSolanaSlot(10n),
  },
]);
function quote(reverse = false) {
  return createExecutableQuote({
    fingerprint: reverse ? "reverse" : "entry",
    inputMint: reverse ? token : sol,
    outputMint: reverse ? sol : token,
    inputAmount: asRawAmount(reverse ? 10_000_000n : 1_000_000_000n),
    expectedOutputAmount: asRawAmount(reverse ? 950_000_000n : 10_000_000n),
    minimumOutputAmount: asRawAmount(reverse ? 930_000_000n : 9_850_000n),
    slippageBasisPoints: asBasisPoints(150n),
    priceImpactPercentage: asPercentage(reverse ? 3 : 2),
    routePlan: ["pool"],
    contextSlot: asSolanaSlot(10n),
    requestedAt: received,
    receivedAt: received,
    evidence,
  });
}
function snapshot(eligible = true) {
  return createEntryGateSnapshot({
    stage: "approval",
    evaluatedAt: at,
    entryQuote: quote(),
    reverseQuote: quote(true),
    positionValueSol: asNonNegativeDecimal(1),
    estimatedExecutionCostsSol: asNonNegativeDecimal("0.01"),
    simulation: { succeeded: true, contextSlot: asSolanaSlot(10n), quoteFingerprint: "entry" },
    finalRecalculation: {
      securityRulesPassed: eligible,
      exposureRulesPassed: true,
      quoteFingerprint: "entry",
    },
    approval: createEntryApproval({
      issuedAt: received,
      eligibilityHash: "hash",
      quoteFingerprint: "entry",
    }),
    currentEligibilityHash: "hash",
    submissionFailed: false,
  });
}
const swap = {
  fingerprint: "tx",
  quoteFingerprint: "entry",
  wallet: "wallet" as WalletAddress,
  serializedTransactionBase64: "AQ==",
  lastValidBlockHeight: 20n,
  prioritizationFeeLamports: asRawAmount(1n),
  requestedAt: received,
  receivedAt: received,
  evidence,
};
describe("durable entry preparation", () => {
  it("persists an eligible quote-bound transaction", async () => {
    let saved: PersistEntryPreparation | undefined;
    const decision = await prepareEntry({
      signalId,
      orderId,
      snapshot: snapshot(),
      constructedSwap: swap,
      repository: {
        saveEntryPreparation: async (input) => {
          saved = input;
        },
      },
    });
    expect(decision.eligible).toBe(true);
    expect(saved?.constructedSwap?.fingerprint).toBe("tx");
  });
  it("persists rejection without executable transaction", async () => {
    let saved: PersistEntryPreparation | undefined;
    const decision = await prepareEntry({
      signalId,
      orderId,
      snapshot: snapshot(false),
      constructedSwap: swap,
      repository: {
        saveEntryPreparation: async (input) => {
          saved = input;
        },
      },
    });
    expect(decision.eligible).toBe(false);
    expect(saved?.constructedSwap).toBeNull();
  });
  it("rolls back when atomic job completion fails", async () => {
    const queries: string[] = [];
    const client = {
      query: async (text: string) => {
        queries.push(text);
        if (text.includes("job_type='entry_planning'")) return { rowCount: 0, rows: [] };
        return { rowCount: 1, rows: [] };
      },
      release: () => undefined,
    } as never;
    await expect(
      prepareEntry({
        signalId,
        orderId,
        snapshot: snapshot(),
        constructedSwap: swap,
        repository: new PostgresEntryPreparationRepository({ connect: async () => client }),
      }),
    ).rejects.toThrow("one available job");
    expect(queries.at(-1)).toBe("ROLLBACK");
  });
});
