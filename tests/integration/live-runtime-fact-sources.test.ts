import { describe, expect, it } from "vitest";

import {
  LiveChainRuntimeFactSource,
  LiveMarketRuntimeFactSource,
} from "../../src/application/services/live-runtime-fact-sources.js";
import {
  asDecimal,
  asRawAmount,
  asSolanaSlot,
  asTimestamp,
  asUuid,
  type EvidenceId,
  type MintAddress,
  type PoolId,
  type PositionId,
  type WalletAddress,
} from "../../src/domain/shared/types.js";

const observedAt = asTimestamp("2026-08-04T12:00:00.000Z");
const positionId = asUuid<PositionId>("00000000-0000-4000-8000-000000003101");
const mint = "mint" as MintAddress;
const wallet = "wallet" as WalletAddress;
const checkpoint = { positionId, revision: 2n, runtimeState: { pendingExit: null } } as never;
const contexts = { load: async () => ({ wallet, tokenMint: mint }) };

describe("live runtime fact sources", () => {
  it("normalizes live market provenance into a revision-ready fragment", async () => {
    const source = new LiveMarketRuntimeFactSource(contexts, {
      observePrimaryPool: async () => ({
        ok: true,
        value: {
          mint,
          poolId: "pool" as PoolId,
          pairAddress: "pair",
          dexId: "raydium",
          baseMint: mint,
          quoteMint: "SOL",
          pairCreatedAt: null,
          liquidityUsd: asDecimal("10000"),
          marketCapitalizationUsd: null,
          fullyDilutedValuationUsd: null,
          fiveMinuteVolumeUsd: null,
          fiveMinuteBuys: null,
          fiveMinuteSells: null,
          fiveMinutePriceChangePercentage: null,
          trace: {
            evidenceId: asUuid<EvidenceId>("00000000-0000-4000-8000-000000003102"),
            provider: "dexscreener",
            method: "GET",
            requestedAt: observedAt,
            respondedAt: observedAt,
            sourceTimestamp: null,
            normalizedAt: observedAt,
            sourceKey: "pair",
            contentHash: "a".repeat(64),
          },
        },
      }),
    });
    await expect(source.collect(checkpoint, observedAt)).resolves.toMatchObject({
      kind: "market",
      provider: "dexscreener",
      facts: { evidence: [{ sourceKey: "pair" }] },
    });
  });

  it("requires agreed live chain balances and emits position authority", async () => {
    const source = new LiveChainRuntimeFactSource(contexts, {
      observeBalances: async () => ({
        ok: true,
        value: {
          wallet,
          mint,
          nativeBalanceLamports: asRawAmount(2n),
          tokenBalanceRaw: asRawAmount(3n),
          slot: asSolanaSlot(4n),
          agreeingProviders: ["solana_rpc"],
          traces: [],
        },
      }),
    });
    await expect(source.collect(checkpoint, observedAt)).resolves.toMatchObject({
      kind: "chain",
      provider: "solana_rpc",
      facts: { wallet, tokenMint: mint },
    });
  });

  it("fails closed on a provider failure", async () => {
    const source = new LiveMarketRuntimeFactSource(contexts, {
      observePrimaryPool: async () => ({
        ok: false,
        error: {
          code: "unavailable",
          provider: "dexscreener",
          occurredAt: observedAt,
          retryable: true,
          reason: "offline",
        },
      }),
    });
    await expect(source.collect(checkpoint, observedAt)).rejects.toThrow(/unavailable.*offline/);
  });
});
