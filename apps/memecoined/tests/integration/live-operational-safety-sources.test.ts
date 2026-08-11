import { describe, expect, it } from "vitest";

import { LivePortfolioOperationalSafetyInputSource } from "../../src/application/services/live-operational-safety-sources.js";
import { asDecimal, asTimestamp, asUuid } from "../../src/domain/shared/types.js";
import type { EvidenceId, PositionId, WalletAddress } from "../../src/domain/shared/types.js";

const at = asTimestamp("2026-08-10T12:00:00.000Z");
const wallet = "wallet" as WalletAddress;
const evidence = (id: string) =>
  Object.freeze({
    id: asUuid<EvidenceId>(id),
    provider: "solana_rpc" as const,
    observedAt: at,
    sourceKey: id,
  });
const id1 = "11111111-1111-4111-8111-111111111111";
const id2 = "22222222-2222-4222-8222-222222222222";
const id3 = "33333333-3333-4333-8333-333333333333";

function source(positions: readonly any[]) {
  return new LivePortfolioOperationalSafetyInputSource(
    wallet,
    {
      observeOpenPositions: async () => ({
        wallet,
        observedAt: at,
        liquidNativeSol: asDecimal("4"),
        reservedEntryCostSol: asDecimal("0.1"),
        usesLeverageOrBorrowing: false,
        positions,
        evidence: [evidence(id1)],
      }),
    },
    {
      observeFailures: async () => ({
        wallet,
        observedAt: at,
        failuresLast24Hours: 1n,
        evidence: [evidence(id2)],
      }),
    },
    {
      observeHealth: async () => ({
        wallet,
        observedAt: at,
        authoritativeDisagreementDurationMs: 20n,
        evidence: [evidence(id3)],
      }),
    },
  );
}

describe("live portfolio operational safety inputs", () => {
  it("aggregates complete executable position authority", async () => {
    const result = await source([
      {
        positionId: asUuid<PositionId>("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
        remainingCostBasisSol: asDecimal("3"),
        executableValueSol: asDecimal("2.25"),
        evidence: [evidence("44444444-4444-4444-8444-444444444444")],
      },
    ]).observePositions(at);
    expect(result).toMatchObject({ openPositionCount: 1n });
    expect(result.openCostExposureSol.toString()).toBe("3");
    expect(result.executableUnrealizedLossSol.toString()).toBe("0.75");
  });

  it("rejects an open position without executable evidence", async () => {
    await expect(
      source([
        {
          positionId: asUuid<PositionId>("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
          remainingCostBasisSol: asDecimal("3"),
          executableValueSol: asDecimal("2"),
          evidence: [],
        },
      ]).observePositions(at),
    ).rejects.toThrow("Every open position");
  });

  it("passes through same-instant reconciliation and provider health", async () => {
    const live = source([]);
    await expect(live.observeReconciliation(at)).resolves.toMatchObject({
      failuresLast24Hours: 1n,
    });
    await expect(live.observeProviderHealth(at)).resolves.toMatchObject({
      authoritativeDisagreementDurationMs: 20n,
    });
  });
});
