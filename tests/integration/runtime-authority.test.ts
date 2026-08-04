import { describe, expect, it, vi } from "vitest";

import { AuthoritativeRuntimeFactSnapshotSource } from "../../src/application/services/live-runtime-fact-sources.js";
import {
  asTimestamp,
  asUuid,
  type EvidenceId,
  type PositionId,
  type TokenId,
} from "../../src/domain/shared/types.js";
import { PostgresPositionRuntimeAuthorityRepository } from "../../src/infrastructure/database/runtime-authority.js";

const positionId = asUuid<PositionId>("00000000-0000-4000-8000-000000003201");
const tokenId = asUuid<TokenId>("00000000-0000-4000-8000-000000003202");
const evidenceId = asUuid<EvidenceId>("00000000-0000-4000-8000-000000003203");
const observedAt = asTimestamp("2026-08-04T12:00:00.000Z");
const checkpoint = {
  positionId,
  revision: 5n,
  runtimeState: {
    pendingExit: null,
    lifecycle: { position: { id: positionId, tokenId } },
  },
} as never;

describe("position runtime authority repository", () => {
  it("loads immutable position context only when it matches the checkpoint", async () => {
    const query = vi.fn(async () => ({
      rowCount: 1,
      rows: [
        {
          position_id: positionId,
          token_id: tokenId,
          wallet: "wallet",
          token_mint: "mint",
          settlement_mint: "settlement",
        },
      ],
    }));
    const repository = new PostgresPositionRuntimeAuthorityRepository({ query } as never);
    await expect(repository.load(checkpoint)).resolves.toEqual({
      wallet: "wallet",
      tokenMint: "mint",
    });
  });

  it("rejects malformed authority before persistence", async () => {
    const query = vi.fn();
    const repository = new PostgresPositionRuntimeAuthorityRepository({ query } as never);
    await expect(
      repository.recordSnapshot({
        id: evidenceId,
        positionId,
        checkpointRevision: 5n,
        phase: "monitor",
        kind: "security",
        provider: "solana_rpc",
        sourceKey: "security:mint:5",
        observedAt,
        facts: { dangerousSecurityChangeDetected: "unknown" },
      }),
    ).rejects.toThrow(/malformed/);
    expect(query).not.toHaveBeenCalled();
  });

  it("loads an exact revision-bound wallet snapshot", async () => {
    const facts = {
      developerRelatedSoldPercentage: "1",
      originatingTierASoldPercentage: null,
      confirmingTierBSoldPercentages: ["2", "3"],
    };
    const query = vi.fn(async () => ({
      rowCount: 1,
      rows: [
        {
          id: evidenceId,
          provider: "solana_rpc",
          source_key: "wallet:5",
          observed_at: observedAt,
          content_hash: "a".repeat(64),
          payload_json: facts,
        },
      ],
    }));
    const repository = new PostgresPositionRuntimeAuthorityRepository({ query } as never);
    const source = new AuthoritativeRuntimeFactSnapshotSource(
      repository.source("wallet", "solana_rpc"),
    );
    await expect(source.collect(checkpoint, observedAt)).resolves.toMatchObject({
      kind: "wallet",
      phase: "monitor",
      sourceKey: "wallet:5",
      facts,
    });
    expect((query.mock.calls as unknown[][])[0]?.[1]).toEqual([
      positionId,
      "5",
      "monitor",
      "wallet",
      observedAt,
    ]);
  });

  it("allows only execution authority during reconciliation", async () => {
    const pending = {
      positionId,
      revision: 5n,
      runtimeState: { pendingExit: {}, lifecycle: { position: { id: positionId, tokenId } } },
    } as never;
    const wallet = new AuthoritativeRuntimeFactSnapshotSource({
      kind: "wallet",
      provider: "solana_rpc",
      load: vi.fn(),
    });
    await expect(wallet.collect(pending, observedAt)).rejects.toThrow(/Only execution/);
  });
});
