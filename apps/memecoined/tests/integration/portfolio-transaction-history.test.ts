import { describe, expect, it } from "vitest";

import { classifyPortfolioTransactionHistory } from "../../src/application/services/portfolio-transaction-history.js";
import {
  asDecimal,
  asTimestamp,
  asUuid,
  type EvidenceId,
  type WalletAddress,
} from "../../src/domain/shared/types.js";

const at = asTimestamp("2026-08-05T12:00:00Z");
const started = asTimestamp("2026-08-01T00:00:00Z");
const wallet = "wallet" as WalletAddress;

function evidence(suffix: string) {
  return {
    id: asUuid<EvidenceId>(`00000000-0000-4000-8000-0000000000${suffix}`),
    provider: "solana_rpc" as const,
    observedAt: at,
    sourceKey: suffix,
    contentHash: suffix.repeat(64).slice(0, 64),
  };
}

function observation() {
  return {
    wallet,
    observedAt: at,
    coverageStartedAt: started,
    systemActivityStartedAt: started,
    realizations: [
      {
        id: "r1",
        occurredAt: started,
        realizedPnlDeltaSol: asDecimal(-1),
        closesPosition: true,
        evidence: evidence("01"),
      },
      {
        id: "r2",
        occurredAt: asTimestamp("2026-08-02T00:00:00Z"),
        realizedPnlDeltaSol: asDecimal(-2),
        closesPosition: true,
        evidence: evidence("02"),
      },
      {
        id: "r3",
        occurredAt: asTimestamp("2026-08-03T00:00:00Z"),
        realizedPnlDeltaSol: asDecimal(0.5),
        closesPosition: false,
        evidence: evidence("03"),
      },
    ],
    walletInitiatedTransactions: [
      { signature: "known", occurredAt: started, successful: true, evidence: evidence("04") },
      {
        signature: "failed-unknown",
        occurredAt: started,
        successful: false,
        evidence: evidence("05"),
      },
    ],
    authorizedSignatures: ["known"],
  };
}

describe("portfolio transaction history", () => {
  it("derives realized P&L, full-closure loss streak, and signature authorization", async () => {
    const result = await classifyPortfolioTransactionHistory({
      source: { observe: async () => observation() },
      wallet,
      observedAt: at,
    });
    expect(result.cumulativeRealizedPnlSol.toString()).toBe("-2.5");
    expect(result.consecutiveClosedLosingTrades).toBe(2n);
    expect(result.unauthorizedTransactionDetected).toBe(false);
    expect(Object.isFrozen(result.evidence)).toBe(true);
  });

  it("detects successful wallet activity without a durable authorized signature", async () => {
    const value = observation();
    const source = {
      observe: async () => ({
        ...value,
        walletInitiatedTransactions: [
          ...value.walletInitiatedTransactions,
          { signature: "unknown", occurredAt: at, successful: true, evidence: evidence("06") },
        ],
      }),
    };
    const result = await classifyPortfolioTransactionHistory({ source, wallet, observedAt: at });
    expect(result.unauthorizedTransactionDetected).toBe(true);
  });

  it("fails closed on incomplete coverage, mismatched identity, duplicates, or future facts", async () => {
    const value = observation();
    const run = (overrides: Partial<typeof value>) =>
      classifyPortfolioTransactionHistory({
        source: { observe: async () => ({ ...value, ...overrides }) },
        wallet,
        observedAt: at,
      });
    await expect(run({ coverageStartedAt: asTimestamp("2026-08-02T00:00:00Z") })).rejects.toThrow(
      /cover all system activity/,
    );
    await expect(run({ wallet: "other" as WalletAddress })).rejects.toThrow(/mismatched wallet/);
    await expect(run({ authorizedSignatures: ["known", "known"] })).rejects.toThrow(
      /must be unique/,
    );
    await expect(
      run({
        walletInitiatedTransactions: [
          {
            signature: "future",
            occurredAt: asTimestamp("2026-08-06T00:00:00Z"),
            successful: true,
            evidence: evidence("07"),
          },
        ],
      }),
    ).rejects.toThrow(/future activity/);
  });
});
