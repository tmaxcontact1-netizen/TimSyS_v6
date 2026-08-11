import { describe, expect, it, vi } from "vitest";
import { produceMonitoringRuntimeAuthority } from "../../src/application/services/runtime-authority-production.js";
import type { PositionRuntimeAuthoritySnapshotInput } from "../../src/infrastructure/database/runtime-authority.js";
import {
  asPercentage,
  asRawAmount,
  asTimestamp,
  asUuid,
  type EvidenceId,
  type PositionId,
  type TokenId,
} from "../../src/domain/shared/types.js";

const positionId = asUuid<PositionId>("00000000-0000-4000-8000-000000004201");
const tokenId = asUuid<TokenId>("00000000-0000-4000-8000-000000004202");
const observedAt = asTimestamp("2026-08-04T12:00:00.000Z");
const evidence = [
  {
    id: asUuid<EvidenceId>("00000000-0000-4000-8000-000000004203"),
    provider: "solana_rpc" as const,
    observedAt,
    sourceKey: "mint:authority",
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
const checkpoint = {
  positionId,
  revision: 8n,
  runtimeState: { pendingExit: null, lifecycle: { position: { id: positionId, tokenId } } },
} as never;
const validSource = () => ({
  context: { wallet: "wallet", tokenMint: "mint", settlementMint: "settlement" } as never,
  history: {
    liquidityUsdTenMinutesAgo: null,
    priorFullExitPriceImpactPercentages: [],
    marketDataUnavailableSince: null,
    allChainAccessUnavailableSince: null,
    evidence: [],
  },
  wallets: {
    developerRelated: [
      {
        wallet: "developer" as never,
        entryBalanceRaw: asRawAmount(100n),
        currentBalanceRaw: asRawAmount(90n),
      },
    ],
    originatingTierA: null,
    confirmingTierB: null,
  },
  entrySecurity: security,
  currentSecurity: security,
});

describe("runtime authority production", () => {
  it("derives every monitoring authority before recording deterministic snapshots", async () => {
    const recordSnapshot = vi.fn(
      async (_input: PositionRuntimeAuthoritySnapshotInput) => undefined,
    );
    await produceMonitoringRuntimeAuthority({
      checkpoint,
      observedAt,
      sink: { recordSnapshot },
      source: { load: async () => validSource() },
    });
    expect(recordSnapshot).toHaveBeenCalledTimes(3);
    expect(recordSnapshot.mock.calls.map(([value]) => value.kind).sort()).toEqual([
      "execution",
      "security",
      "wallet",
    ]);
    expect(
      recordSnapshot.mock.calls.find(([value]) => value.kind === "wallet")?.[0].facts,
    ).toMatchObject({ developerRelatedSoldPercentage: "10" });
  });

  it("records nothing when any authority derivation fails", async () => {
    const recordSnapshot = vi.fn((_input: PositionRuntimeAuthoritySnapshotInput) =>
      Promise.resolve(),
    );
    const invalid = validSource();
    invalid.wallets.developerRelated[0]!.currentBalanceRaw = asRawAmount(101n);
    await expect(
      produceMonitoringRuntimeAuthority({
        checkpoint,
        observedAt,
        sink: { recordSnapshot },
        source: { load: async () => invalid },
      }),
    ).rejects.toThrow(/exceeds/);
    expect(recordSnapshot).not.toHaveBeenCalled();
  });
});
