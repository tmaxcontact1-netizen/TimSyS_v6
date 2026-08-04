import type { QueryResult } from "pg";
import { describe, expect, it } from "vitest";

import {
  asTimestamp,
  asUuid,
  type EvidenceId,
  type PositionId,
} from "../../src/domain/shared/types.js";
import { PostgresPositionObservationStore } from "../../src/infrastructure/database/position-observations.js";

const id = asUuid<EvidenceId>("00000000-0000-4000-8000-000000001001");
const positionId = asUuid<PositionId>("00000000-0000-4000-8000-000000001002");
const observedAt = asTimestamp("2026-08-04T12:00:00.000Z");

function row(contentHash: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    position_id: positionId,
    observation_kind: "market",
    provider: "dexscreener",
    source_key: "pair:1",
    observed_at: observedAt,
    content_hash: contentHash,
    ...overrides,
  };
}

describe("position observation ingestion", () => {
  it("canonicalizes payload keys and persists immutable evidence", async () => {
    const calls: readonly unknown[][] = [];
    const database = {
      query: async (_sql: string, values: readonly unknown[]) => {
        (calls as unknown[][]).push([...values]);
        return { rows: [row(values[6] as string)], rowCount: 1 } as QueryResult<never>;
      },
    };
    const store = new PostgresPositionObservationStore(database as never);
    const first = await store.ingest({
      id,
      positionId,
      kind: "market",
      provider: "dexscreener",
      sourceKey: "pair:1",
      observedAt,
      payload: { z: 1, nested: { b: 2, a: 1 } },
    });
    expect(first.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(calls[0]?.[7]).toBe('{"nested":{"a":1,"b":2},"z":1}');
  });

  it("accepts an exact idempotent replay and rejects identity drift", async () => {
    let expectedHash = "";
    let drift = false;
    const database = {
      query: async (sql: string, values: readonly unknown[]) => {
        if (sql.startsWith("INSERT")) {
          expectedHash = values[6] as string;
          return { rows: [], rowCount: 0 };
        }
        return {
          rows: [row(expectedHash, drift ? { source_key: "different" } : {})],
          rowCount: 1,
        };
      },
    };
    const store = new PostgresPositionObservationStore(database as never);
    const input = {
      id,
      positionId,
      kind: "market" as const,
      provider: "dexscreener" as const,
      sourceKey: "pair:1",
      observedAt,
      payload: { price: "1.25" },
    };
    await expect(store.ingest(input)).resolves.toMatchObject({ contentHash: expect.any(String) });
    drift = true;
    await expect(store.ingest(input)).rejects.toThrow(/conflicts/);
  });

  it("rejects non-JSON evidence before database access", async () => {
    const database = { query: async () => ({ rows: [], rowCount: 0 }) };
    await expect(
      new PostgresPositionObservationStore(database as never).ingest({
        id,
        positionId,
        kind: "market",
        provider: "dexscreener",
        sourceKey: "pair:1",
        observedAt,
        payload: { amount: 1n },
      }),
    ).rejects.toThrow(/JSON-compatible/);
  });

  it("loads fact evidence in database order and fails closed on a truncated window", async () => {
    const secondId = asUuid<EvidenceId>("00000000-0000-4000-8000-000000001004");
    const rows = [
      { ...row("a".repeat(64)), payload_json: { value: 1 } },
      {
        ...row("b".repeat(64), { id: secondId, observed_at: "2026-08-04T12:00:01.000Z" }),
        payload_json: { value: 2 },
      },
    ];
    const database = {
      query: async (_sql: string, values: readonly unknown[]) => ({
        rows: rows.slice(0, values[2] as number),
        rowCount: rows.length,
      }),
    };
    const store = new PostgresPositionObservationStore(database as never);
    await expect(
      store.listRuntimeFactObservations({
        positionId,
        evaluatedAt: asTimestamp("2026-08-04T12:00:02.000Z"),
        limit: 2,
      }),
    ).resolves.toMatchObject([{ id }, { id: secondId }]);
    await expect(
      store.listRuntimeFactObservations({ positionId, evaluatedAt: observedAt, limit: 1 }),
    ).rejects.toThrow(/exceeded/);
  });
});
