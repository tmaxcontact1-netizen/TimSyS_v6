import type { QueryResult } from "pg";
import { describe, expect, it } from "vitest";

import { asUuid, type PositionId } from "../../src/domain/shared/types.js";
import {
  PostgresPositionMonitoringFactsSource,
  PostgresPositionReconciliationFactsSource,
} from "../../src/infrastructure/database/runtime-facts.js";

const positionId = asUuid<PositionId>("00000000-0000-4000-8000-000000000901");
const ids = {
  token: "00000000-0000-4000-8000-000000000902",
  order: "00000000-0000-4000-8000-000000000903",
  peak: "00000000-0000-4000-8000-000000000904",
  exit: "00000000-0000-4000-8000-000000000905",
  event: "00000000-0000-4000-8000-000000000906",
};
const checkpoint = { positionId, revision: 7n } as never;

function database(payloads: readonly unknown[]) {
  const calls: readonly unknown[][] = [];
  let index = 0;
  return {
    calls,
    query: async (_sql: string, values: readonly unknown[]) => {
      (calls as unknown[][]).push([...values]);
      const payload = payloads[index++];
      const rows = payload === undefined ? [] : [{ payload_json: payload }];
      return { rows, rowCount: rows.length } as QueryResult<{ payload_json: unknown }>;
    },
  };
}

describe("revision-bound PostgreSQL runtime facts", () => {
  it("loads and converts one exact monitoring snapshot", async () => {
    const db = database([
      {
        stepId: "monitor-7",
        positionId,
        tokenId: ids.token,
        observationRequestedAt: "2026-08-04T10:00:00.000Z",
        evaluatedAt: "2026-08-04T10:00:01.000Z",
        wallet: "wallet",
        tokenMint: "token-mint",
        settlementMint: "settlement-mint",
        liquidityUsdTenMinutesAgo: "1250.5",
        developerRelatedSoldPercentage: null,
        originatingTierASoldPercentage: "12",
        confirmingTierBSoldPercentages: ["3", "4"],
        dangerousSecurityChangeDetected: false,
        priorFullExitPriceImpactPercentages: ["1.25"],
        marketDataUnavailableSince: null,
        allChainAccessUnavailableSince: null,
        evidence: [],
        orderId: ids.order,
        peakEventId: ids.peak,
        exitRequestedEventId: ids.exit,
      },
    ]);
    const facts = await new PostgresPositionMonitoringFactsSource(db as never).loadFacts(
      checkpoint,
    );
    expect(facts.stepId).toBe("monitor-7");
    expect(facts.liquidityUsdTenMinutesAgo?.toString()).toBe("1250.5");
    expect(db.calls[0]).toEqual([positionId, "7", "monitor"]);
  });

  it("loads reconciliation identity only for the exact revision", async () => {
    const db = database([
      {
        stepId: "reconcile-7",
        observationRequestedAt: "2026-08-04T10:00:00.000Z",
        evaluatedAt: "2026-08-04T10:00:01.000Z",
        wallet: "wallet",
        tokenMint: "token-mint",
        eventId: ids.event,
      },
    ]);
    const facts = await new PostgresPositionReconciliationFactsSource(db as never).loadFacts(
      checkpoint,
    );
    expect(facts.eventId).toBe(ids.event);
    expect(db.calls[0]).toEqual([positionId, "7", "reconcile"]);
  });

  it("rejects absent and malformed snapshots", async () => {
    await expect(
      new PostgresPositionMonitoringFactsSource(database([]) as never).loadFacts(checkpoint),
    ).rejects.toThrow(/Exactly one monitor/);
    await expect(
      new PostgresPositionReconciliationFactsSource(database([{ stepId: "" }]) as never).loadFacts(
        checkpoint,
      ),
    ).rejects.toThrow(/malformed/);
  });
});
