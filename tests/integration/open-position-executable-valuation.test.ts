import { describe, expect, it } from "vitest";

import { LiveOpenPositionExecutableValuationSource } from "../../src/application/services/open-position-executable-valuation.js";
import {
  asDecimal,
  asRawAmount,
  asTimestamp,
  asUuid,
  type EvidenceId,
  type MintAddress,
  type PositionId,
  type WalletAddress,
} from "../../src/domain/shared/types.js";

const at = asTimestamp("2026-08-10T12:00:00.000Z");
const wallet = "wallet" as WalletAddress;
const mint = "token" as MintAddress;
const settlement = "sol" as MintAddress;
const evidence = Object.freeze({
  id: asUuid<EvidenceId>("11111111-1111-4111-8111-111111111111"),
  provider: "jupiter" as const,
  observedAt: at,
  sourceKey: "quote",
});
const inventory = {
  observeInventory: async () => ({
    wallet,
    observedAt: at,
    liquidNativeSol: asDecimal("2"),
    reservedEntryCostSol: asDecimal("0.01"),
    usesLeverageOrBorrowing: false,
    evidence: [{ ...evidence, id: asUuid<EvidenceId>("22222222-2222-4222-8222-222222222222") }],
    positions: [
      {
        positionId: asUuid<PositionId>("33333333-3333-4333-8333-333333333333"),
        tokenMint: mint,
        settlementMint: settlement,
        currentAmount: asRawAmount(100n),
        remainingCostBasisSol: asDecimal("1.5"),
        evidence: [{ ...evidence, id: asUuid<EvidenceId>("44444444-4444-4444-8444-444444444444") }],
      },
    ],
  }),
};

describe("open position executable valuation", () => {
  it("values the complete current amount with the production exit tolerance", async () => {
    const source = new LiveOpenPositionExecutableValuationSource(wallet, inventory, {
      quote: async (request) => ({
        ok: true,
        value: {
          fingerprint: "quote",
          ...request,
          expectedOutputAmount: asRawAmount(1_200_000_000n),
          minimumOutputAmount: asRawAmount(1_000_000_000n),
          priceImpactPercentage: null,
          routePlan: ["amm"],
          contextSlot: null,
          receivedAt: at,
          evidence: [evidence],
        },
      }),
    });
    const result = await source.observeOpenPositions(at);
    expect(result.positions[0]?.executableValueSol.toString()).toBe("1.2");
    expect(result.positions[0]?.evidence).toHaveLength(2);
  });

  it("fails closed when any full-exit quote is unavailable", async () => {
    const source = new LiveOpenPositionExecutableValuationSource(wallet, inventory, {
      quote: async () => ({
        ok: false,
        error: {
          code: "unavailable",
          provider: "jupiter",
          occurredAt: at,
          retryable: true,
          reason: "offline",
        },
      }),
    });
    await expect(source.observeOpenPositions(at)).rejects.toThrow(/unavailable.*offline/);
  });
});
