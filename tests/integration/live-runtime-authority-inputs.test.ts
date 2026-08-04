import { describe, expect, it, vi } from "vitest";

import {
  LiveMonitoringRuntimeAuthorityInputSource,
  LiveReconciliationRuntimeAuthorityInputSource,
} from "../../src/application/services/live-runtime-authority-inputs.js";
import {
  asPercentage,
  asRawAmount,
  asTimestamp,
  asUuid,
  type EvidenceId,
  type PositionId,
} from "../../src/domain/shared/types.js";

const positionId = asUuid<PositionId>("00000000-0000-4000-8000-000000009101");
const observedAt = asTimestamp("2026-08-04T12:00:00.000Z");
const evidence = [
  {
    id: asUuid<EvidenceId>("00000000-0000-4000-8000-000000009102"),
    provider: "solana_rpc" as const,
    observedAt,
    sourceKey: "mint",
    contentHash: "a".repeat(64),
  },
];
const security = {
  observedAt,
  evidence,
  directlyVerifiedOnChain: true,
  program: "spl_token" as const,
  mintAuthority: "revoked" as const,
  freezeAuthority: "revoked" as const,
  extensions: [],
  extensionsVerified: true,
  holders: {
    topTenNormalPercentage: asPercentage("20"),
    largestNormalPercentage: asPercentage("5"),
    exclusionsVerified: true,
  },
};
const baseline = {
  capturedAt: asTimestamp("2026-08-04T11:00:00.000Z"),
  wallet: "trader",
  tokenMint: "mint",
  settlementMint: "settlement",
  developerRelated: [{ wallet: "developer", entryBalanceRaw: asRawAmount(100n) }],
  originatingTierA: null,
  confirmingTierB: null,
  excludedHolderTokenAccounts: new Set<string>(),
  entrySecurity: security,
  history: {
    liquidityUsdTenMinutesAgo: null,
    priorFullExitPriceImpactPercentages: [],
    marketDataUnavailableSince: null,
    allChainAccessUnavailableSince: null,
    evidence: [],
  },
} as never;

describe("live runtime authority inputs", () => {
  it("combines immutable entry balances with confirmed current balances and mint security", async () => {
    const source = new LiveMonitoringRuntimeAuthorityInputSource(
      { load: async () => baseline },
      {
        observeBalances: async () => ({
          ok: true,
          value: { tokenBalanceRaw: asRawAmount(80n) } as never,
        }),
      },
      { observe: async () => security },
    );
    const loaded = await source.load({ checkpoint: { positionId } as never, observedAt });
    expect(loaded.wallets.developerRelated[0]).toMatchObject({
      entryBalanceRaw: 100n,
      currentBalanceRaw: 80n,
    });
    expect(loaded.currentSecurity).toBe(security);
  });

  it("rejects a tracked-wallet provider failure", async () => {
    const source = new LiveMonitoringRuntimeAuthorityInputSource(
      { load: async () => baseline },
      { observeBalances: async () => ({ ok: false, error: { code: "unavailable" } as never }) },
      { observe: vi.fn() },
    );
    await expect(source.load({ checkpoint: { positionId } as never, observedAt })).rejects.toThrow(
      /balance unavailable/,
    );
  });

  it("requires successful on-chain confirmation for reconciliation authority", async () => {
    const source = new LiveReconciliationRuntimeAuthorityInputSource(
      { load: async () => baseline },
      {
        observeTransaction: async () => ({
          ok: true,
          value: { state: "pending", onChainError: null } as never,
        }),
      },
    );
    const checkpoint = {
      positionId,
      runtimeState: { pendingExit: { submission: { signature: "signature" } } },
    } as never;
    await expect(source.load({ checkpoint, observedAt })).rejects.toThrow(/not confirmed/);
  });
});
