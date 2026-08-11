import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import type { PositionRuntimeAuthorityBaseline } from "../../src/application/ports/runtime-authority-inputs.js";
import {
  asPercentage,
  asRawAmount,
  asTimestamp,
  asUuid,
  type EvidenceId,
  type PositionId,
} from "../../src/domain/shared/types.js";
import { PostgresRuntimeAuthorityBaselineSource } from "../../src/infrastructure/database/runtime-authority-baselines.js";

const positionId = asUuid<PositionId>("00000000-0000-4000-8000-000000009201");
const capturedAt = asTimestamp("2026-08-04T12:00:00.000Z");
const evidence = {
  id: asUuid<EvidenceId>("00000000-0000-4000-8000-000000009202"),
  provider: "solana_rpc" as const,
  observedAt: asTimestamp("2026-08-04T11:59:00.000Z"),
  sourceKey: "mint:entry",
  slot: 123n as never,
  contentHash: "a".repeat(64),
};

function baseline(): PositionRuntimeAuthorityBaseline {
  return {
    capturedAt,
    wallet: "trader" as never,
    tokenMint: "mint" as never,
    settlementMint: "settlement" as never,
    developerRelated: [{ wallet: "developer" as never, entryBalanceRaw: asRawAmount(100n) }],
    originatingTierA: null,
    confirmingTierB: null,
    excludedHolderTokenAccounts: new Set(["pool", "burn"]),
    entrySecurity: {
      observedAt: evidence.observedAt,
      evidence: [evidence],
      directlyVerifiedOnChain: true,
      program: "spl_token",
      mintAuthority: "revoked",
      freezeAuthority: "revoked",
      extensions: [],
      extensionsVerified: true,
      holders: {
        topTenNormalPercentage: asPercentage("20"),
        largestNormalPercentage: asPercentage("5"),
        exclusionsVerified: true,
      },
    },
    history: {
      liquidityUsdTenMinutesAgo: null,
      priorFullExitPriceImpactPercentages: [],
      marketDataUnavailableSince: null,
      allChainAccessUnavailableSince: null,
      evidence: [],
    },
  };
}

describe("runtime authority baseline persistence", () => {
  it("captures canonical immutable evidence and accepts an exact replay", async () => {
    const query = vi.fn(async (_text: string, values: readonly unknown[]) => ({
      rowCount: 1,
      rows: [
        {
          captured_at: capturedAt,
          content_hash: values[2],
          payload_json: JSON.parse(values[3] as string),
        },
      ],
    }));
    const repository = new PostgresRuntimeAuthorityBaselineSource({ query } as never);
    await expect(repository.capture(positionId, baseline())).resolves.toBeUndefined();
    const values = query.mock.calls[0]?.[1] as readonly unknown[];
    expect(values.slice(0, 2)).toEqual([positionId, capturedAt]);
    expect(values[2]).toBe(
      createHash("sha256")
        .update(values[3] as string)
        .digest("hex"),
    );
    expect(query.mock.calls[0]?.[0]).toContain("ON CONFLICT (position_id) DO NOTHING");
  });

  it("rejects a conflicting immutable replay", async () => {
    const query = vi.fn(async () => ({
      rowCount: 1,
      rows: [
        {
          captured_at: capturedAt,
          content_hash: "b".repeat(64),
          payload_json: {},
        },
      ],
    }));
    const repository = new PostgresRuntimeAuthorityBaselineSource({ query } as never);
    await expect(repository.capture(positionId, baseline())).rejects.toThrow(/conflicts/);
  });

  it("rejects future evidence before touching the database", async () => {
    const query = vi.fn();
    const value = baseline();
    const repository = new PostgresRuntimeAuthorityBaselineSource({ query } as never);
    await expect(
      repository.capture(positionId, {
        ...value,
        capturedAt: asTimestamp("2026-08-04T11:00:00.000Z"),
      }),
    ).rejects.toThrow(/future/);
    expect(query).not.toHaveBeenCalled();
  });

  it("loads the captured payload into branded runtime values", async () => {
    let row: Record<string, unknown> | undefined;
    const query = vi.fn(async (_text: string, values?: readonly unknown[]) => {
      if (values?.length === 4) {
        row = {
          captured_at: values[1],
          content_hash: values[2],
          payload_json: JSON.parse(values[3] as string),
        };
      }
      return { rowCount: row === undefined ? 0 : 1, rows: row === undefined ? [] : [row] };
    });
    const repository = new PostgresRuntimeAuthorityBaselineSource({ query } as never);
    await repository.capture(positionId, baseline());
    const loaded = await repository.load(positionId);
    expect(loaded).toMatchObject({ capturedAt, wallet: "trader", tokenMint: "mint" });
    expect(loaded.developerRelated[0]?.entryBalanceRaw).toBe(100n);
    expect(loaded.excludedHolderTokenAccounts).toEqual(new Set(["burn", "pool"]));
    expect(loaded.entrySecurity.holders?.topTenNormalPercentage.toString()).toBe("20");
  });
});
