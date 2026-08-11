import { describe, expect, it } from "vitest";

import {
  LivePortfolioInventoryValuationSource,
  WRAPPED_SOL_MINT,
} from "../../src/application/services/portfolio-inventory-valuation.js";
import {
  asNonNegativeDecimal,
  asRawAmount,
  asSolanaSlot,
  asTimestamp,
  asUuid,
  type EvidenceId,
  type MintAddress,
  type ProviderId,
  type WalletAddress,
} from "../../src/domain/shared/types.js";

const at = asTimestamp("2026-08-05T12:00:00Z");
const wallet = "wallet" as WalletAddress;
const mint = "mint-a" as MintAddress;

function trace(provider: ProviderId, suffix: string) {
  return {
    evidenceId: asUuid<EvidenceId>(`00000000-0000-4000-8000-0000000000${suffix}`),
    provider,
    method: "GET",
    requestedAt: at,
    respondedAt: at,
    sourceTimestamp: null,
    normalizedAt: at,
    sourceKey: `${provider}:${suffix}`,
    contentHash: suffix.repeat(64).slice(0, 64),
  } as const;
}

function inventory() {
  return {
    observeWalletInventory: async () => ({
      ok: true as const,
      value: {
        wallet,
        nativeBalanceLamports: asRawAmount(2_000_000_000n),
        tokens: [{ mint, amountRaw: asRawAmount(5_000_000n), decimals: 6 }],
        slot: asSolanaSlot(20n),
        agreeingProviders: ["helius", "solana_rpc"] as const,
        traces: [trace("helius", "01"), trace("solana_rpc", "02")],
      },
    }),
  };
}

function market(overrides: { missingPrice?: boolean; mismatchedMint?: boolean } = {}) {
  return {
    observePrimaryPool: async (requestedMint: MintAddress) => ({
      ok: true as const,
      value: {
        mint: overrides.mismatchedMint ? ("wrong" as MintAddress) : requestedMint,
        priceUsd: overrides.missingPrice
          ? null
          : asNonNegativeDecimal(requestedMint === WRAPPED_SOL_MINT ? 200 : 4),
        trace: trace("dexscreener", requestedMint === WRAPPED_SOL_MINT ? "03" : "04"),
      },
    }),
  } as never;
}

describe("portfolio inventory valuation", () => {
  it("values the complete wallet inventory in USD and SOL with immutable evidence", async () => {
    const source = new LivePortfolioInventoryValuationSource(wallet, inventory(), market());
    const result = await source.observe(at);
    expect(result.nativeBalanceSol.toString()).toBe("2");
    expect(result.tokenValueUsd.toString()).toBe("20");
    expect(result.tokenValueSol.toString()).toBe("0.1");
    expect(result.equitySol.toString()).toBe("2.1");
    expect(result.holdings[0]).toMatchObject({ mint });
    expect(result.holdings[0]?.tokenAmount.toString()).toBe("5");
    expect(result.evidence).toHaveLength(4);
    expect(Object.isFrozen(result.holdings)).toBe(true);
    expect(Object.isFrozen(result.evidence)).toBe(true);
  });

  it("fails closed on missing prices or mismatched market identity", async () => {
    await expect(
      new LivePortfolioInventoryValuationSource(
        wallet,
        inventory(),
        market({ missingPrice: true }),
      ).observe(at),
    ).rejects.toThrow(/positive USD price/);
    await expect(
      new LivePortfolioInventoryValuationSource(
        wallet,
        inventory(),
        market({ mismatchedMint: true }),
      ).observe(at),
    ).rejects.toThrow(/mismatched mint/);
  });

  it("propagates inventory authority failures", async () => {
    const unavailable = {
      observeWalletInventory: async () => ({
        ok: false as const,
        error: {
          code: "contradictory" as const,
          provider: "solana_rpc" as const,
          occurredAt: at,
          retryable: true,
          reason: "providers disagree",
        },
      }),
    };
    await expect(
      new LivePortfolioInventoryValuationSource(wallet, unavailable, market()).observe(at),
    ).rejects.toThrow(/contradictory.*providers disagree/);
  });
});
