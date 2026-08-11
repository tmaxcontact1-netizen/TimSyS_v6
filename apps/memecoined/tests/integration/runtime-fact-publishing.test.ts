import { describe, expect, it } from "vitest";

import {
  asDecimal,
  asTimestamp,
  asUuid,
  type AuditEventId,
  type EvidenceId,
  type MintAddress,
  type OrderId,
  type PositionId,
  type TokenId,
  type WalletAddress,
} from "../../src/domain/shared/types.js";
import { PostgresPositionRuntimeFactPublisher } from "../../src/infrastructure/database/runtime-facts.js";

const positionId = asUuid<PositionId>("00000000-0000-4000-8000-000000001101");
const factId = asUuid<EvidenceId>("00000000-0000-4000-8000-000000001102");
const observationId = asUuid<EvidenceId>("00000000-0000-4000-8000-000000001103");
const checkpoint = { positionId, revision: 4n } as never;
const evaluatedAt = asTimestamp("2026-08-04T12:00:01.000Z");
const facts = {
  stepId: "monitor-4",
  positionId,
  tokenId: asUuid<TokenId>("00000000-0000-4000-8000-000000001104"),
  observationRequestedAt: asTimestamp("2026-08-04T12:00:00.000Z"),
  evaluatedAt,
  wallet: "wallet" as WalletAddress,
  tokenMint: "mint" as MintAddress,
  settlementMint: "settlement" as MintAddress,
  liquidityUsdTenMinutesAgo: asDecimal("10"),
  developerRelatedSoldPercentage: null,
  originatingTierASoldPercentage: null,
  confirmingTierBSoldPercentages: null,
  dangerousSecurityChangeDetected: null,
  priorFullExitPriceImpactPercentages: [],
  marketDataUnavailableSince: null,
  allChainAccessUnavailableSince: null,
  evidence: [],
  orderId: asUuid<OrderId>("00000000-0000-4000-8000-000000001105"),
  peakEventId: asUuid<AuditEventId>("00000000-0000-4000-8000-000000001106"),
  exitRequestedEventId: asUuid<AuditEventId>("00000000-0000-4000-8000-000000001107"),
};

function database(
  options: { stale?: boolean; missingObservation?: boolean; conflict?: boolean } = {},
) {
  const calls: string[] = [];
  const client = {
    query: async (sql: string) => {
      calls.push(sql);
      if (sql.startsWith("SELECT version"))
        return {
          rows: [{ version: options.stale === true ? "3" : "4" }],
          rowCount: 1,
        };
      if (sql.startsWith("SELECT id FROM position_observations"))
        return {
          rows: options.missingObservation === true ? [] : [{ id: observationId }],
          rowCount: options.missingObservation === true ? 0 : 1,
        };
      if (sql.startsWith("WITH inserted"))
        return {
          rows: options.conflict === true ? [] : [{ id: factId }],
          rowCount: options.conflict === true ? 0 : 1,
        };
      return { rows: [], rowCount: 0 };
    },
    release: () => undefined,
  };
  return { calls, connect: async () => client };
}

describe("runtime fact publication", () => {
  it("atomically binds a validated snapshot to its checkpoint and observations", async () => {
    const db = database();
    await new PostgresPositionRuntimeFactPublisher(db as never).publish({
      id: factId,
      checkpoint,
      phase: "monitor",
      facts,
      observationIds: [observationId],
    });
    expect(db.calls).toContain("COMMIT");
    expect(
      db.calls.filter((sql) => sql.startsWith("INSERT INTO position_runtime_fact")),
    ).toHaveLength(1);
  });

  it("rejects stale checkpoints and incomplete provenance with rollback", async () => {
    const stale = database({ stale: true });
    await expect(
      new PostgresPositionRuntimeFactPublisher(stale as never).publish({
        id: factId,
        checkpoint,
        phase: "monitor",
        facts,
        observationIds: [observationId],
      }),
    ).rejects.toThrow(/stale/);
    expect(stale.calls).toContain("ROLLBACK");

    const missing = database({ missingObservation: true });
    await expect(
      new PostgresPositionRuntimeFactPublisher(missing as never).publish({
        id: factId,
        checkpoint,
        phase: "monitor",
        facts,
        observationIds: [observationId],
      }),
    ).rejects.toThrow(/complete/);
  });

  it("rejects duplicate provenance and conflicting publication", async () => {
    const publisher = new PostgresPositionRuntimeFactPublisher(database() as never);
    await expect(
      publisher.publish({
        id: factId,
        checkpoint,
        phase: "monitor",
        facts,
        observationIds: [observationId, observationId],
      }),
    ).rejects.toThrow(/unique/);
    await expect(
      new PostgresPositionRuntimeFactPublisher(database({ conflict: true }) as never).publish({
        id: factId,
        checkpoint,
        phase: "monitor",
        facts,
        observationIds: [observationId],
      }),
    ).rejects.toThrow(/conflicts/);
  });
});
