import { Decimal } from "decimal.js";
import type { PoolClient, QueryResult } from "pg";
import { describe, expect, it } from "vitest";

import type { PendingPositionAction } from "../../src/application/ports/repositories.js";
import { createPositionRuntimeState } from "../../src/application/services/position-monitor.js";
import {
  asNonNegativeDecimal,
  asRawAmount,
  asTimestamp,
  asUuid,
  type AuditEventId,
  type Brand,
  type OrderId,
  type PositionId,
  type TokenId,
} from "../../src/domain/shared/types.js";
import {
  applyPositionEvent,
  createEmptyPositionLifecycle,
} from "../../src/domain/trading/position.js";
import { PostgresPositionWorkerCheckpointRepository } from "../../src/infrastructure/database/repositories.js";

function uuid<Value extends Brand<string, string>>(suffix: number): Value {
  return asUuid<Value>(`00000000-0000-4000-8000-${suffix.toString().padStart(12, "0")}`);
}

const positionId = uuid<PositionId>(401);
const opened = {
  type: "position:opened" as const,
  eventId: uuid<AuditEventId>(402),
  positionId,
  aggregateVersion: 0n,
  occurredAt: asTimestamp("2026-08-04T13:00:00Z"),
  tokenId: uuid<TokenId>(403),
  entryOrderId: uuid<OrderId>(404),
  acquiredAmount: asRawAmount(1_000n),
  costBasisSol: asNonNegativeDecimal(10),
};

function runtimeState() {
  return createPositionRuntimeState(applyPositionEvent(createEmptyPositionLifecycle(), opened));
}

const action: PendingPositionAction = Object.freeze({
  deliveryId: `${positionId}:monitor-1`,
  actionId: "monitor-1",
  stepFingerprint: "fingerprint-1",
  action: Object.freeze({
    type: "continue_monitoring",
    decision: Object.freeze({
      action: "none",
      ruleId: null,
      requestedAmount: asRawAmount(0n),
      results: Object.freeze([]),
    }),
  }),
});

interface RecordedQuery {
  readonly text: string;
  readonly values: readonly unknown[];
}

class ScriptedDatabase {
  public readonly queries: RecordedQuery[] = [];
  public readonly responses: QueryResult<Record<string, unknown>>[] = [];
  public released = false;

  public async connect(): Promise<Pick<PoolClient, "query" | "release">> {
    return {
      query: this.query.bind(this),
      release: () => void (this.released = true),
    } as Pick<PoolClient, "query" | "release">;
  }

  public async query<Row extends Record<string, unknown>>(
    text: string,
    values: unknown[] = [],
  ): Promise<QueryResult<Row>> {
    this.queries.push({ text, values });
    const response = this.responses.shift();
    if (response === undefined) return { rows: [], rowCount: null } as unknown as QueryResult<Row>;
    return response as QueryResult<Row>;
  }
}

function row(version: bigint, pending: PendingPositionAction | null = action) {
  const encode = (value: unknown): unknown => {
    if (typeof value === "bigint") return { $type: "bigint", value: value.toString() };
    if (value instanceof Decimal) return { $type: "decimal", value: value.toString() };
    if (Array.isArray(value)) return value.map(encode);
    if (value !== null && typeof value === "object")
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)]));
    return value;
  };
  return {
    id: positionId,
    version: version.toString(),
    payload_json: encode({ positionId, runtimeState: runtimeState(), pendingAction: pending }),
  };
}

function result(rows: Record<string, unknown>[]): QueryResult<Record<string, unknown>> {
  return { rows, rowCount: rows.length } as QueryResult<Record<string, unknown>>;
}

describe("PostgreSQL position checkpoint repository", () => {
  it("initializes exactly one completed checkpoint at revision zero", async () => {
    const database = new ScriptedDatabase();
    database.responses.push(result([row(0n, null)]));
    const repository = new PostgresPositionWorkerCheckpointRepository(database);
    const checkpoint = await repository.initialize({ positionId, runtimeState: runtimeState() });
    expect(checkpoint).toMatchObject({ positionId, revision: 0n, pendingAction: null });
    expect(database.queries[0]?.values.slice(0, 3)).toEqual([
      positionId,
      "position_runtime",
      `position_runtime:${positionId}`,
    ]);
    expect(database.queries[0]?.text).toContain("ON CONFLICT (id) DO NOTHING");
  });

  it("loads and validates tagged bigint and decimal state", async () => {
    const database = new ScriptedDatabase();
    database.responses.push(result([row(7n, null)]));
    const repository = new PostgresPositionWorkerCheckpointRepository(database);
    const checkpoint = await repository.load(positionId);
    expect(checkpoint.revision).toBe(7n);
    expect(checkpoint.runtimeState.lifecycle.position?.currentAmount).toBe(1_000n);
    expect(checkpoint.runtimeState.lifecycle.position?.originalCostBasisSol.equals(10)).toBe(true);
    expect(database.queries[0]?.values).toEqual([positionId, "position_runtime"]);
  });

  it("atomically saves checkpoint, event, pending action and follow-up job", async () => {
    const database = new ScriptedDatabase();
    database.responses.push(
      result([]),
      result([row(1n)]),
      result([]),
      result([]),
      result([]),
      result([]),
    );
    const repository = new PostgresPositionWorkerCheckpointRepository(database);
    const checkpoint = await repository.saveTransition({
      positionId,
      expectedRevision: 0n,
      runtimeState: runtimeState(),
      pendingAction: action,
      emittedEvents: [opened],
    });
    expect(checkpoint.revision).toBe(1n);
    expect(database.queries.map(({ text }) => text.trim().split(/\s+/)[0])).toEqual([
      "BEGIN",
      "UPDATE",
      "SELECT",
      "SELECT",
      "INSERT",
      "COMMIT",
    ]);
    expect(database.queries[1]?.values[3]).toBe("0");
    const persisted = JSON.parse(database.queries[1]?.values[2] as string) as Record<
      string,
      unknown
    >;
    expect(Object.keys(persisted).sort()).toEqual(["pendingAction", "positionId", "runtimeState"]);
    expect(database.released).toBe(true);
  });

  it("chains each audit event to its locked predecessor", async () => {
    const database = new ScriptedDatabase();
    const previousHash = "a".repeat(64);
    database.responses.push(
      result([]),
      result([row(1n)]),
      result([]),
      result([{ after_hash: previousHash }]),
      result([]),
      result([]),
    );
    const repository = new PostgresPositionWorkerCheckpointRepository(database);
    await repository.saveTransition({
      positionId,
      expectedRevision: 0n,
      runtimeState: runtimeState(),
      pendingAction: action,
      emittedEvents: [opened],
    });
    expect(database.queries[2]?.text).toContain("pg_advisory_xact_lock");
    expect(database.queries[4]?.values[5]).toBe(previousHash);
    expect(database.queries[4]?.values[6]).toMatch(/^[0-9a-f]{64}$/);
    expect(database.queries[4]?.values[6]).not.toBe(previousHash);
  });

  it("rolls back a failed compare-and-swap without inserting events", async () => {
    const database = new ScriptedDatabase();
    database.responses.push(result([]), result([]), result([]));
    const repository = new PostgresPositionWorkerCheckpointRepository(database);
    await expect(
      repository.saveTransition({
        positionId,
        expectedRevision: 4n,
        runtimeState: runtimeState(),
        pendingAction: action,
        emittedEvents: [opened],
      }),
    ).rejects.toThrow("concurrency conflict");
    expect(database.queries.map(({ text }) => text.trim())).toEqual([
      "BEGIN",
      expect.stringMatching(/^UPDATE jobs/),
      "ROLLBACK",
    ]);
  });

  it("acknowledges only the exact pending delivery and advances the revision", async () => {
    const database = new ScriptedDatabase();
    database.responses.push(result([row(2n, null)]));
    const repository = new PostgresPositionWorkerCheckpointRepository(database);
    const checkpoint = await repository.acknowledgeAction({
      positionId,
      expectedRevision: 1n,
      deliveryId: action.deliveryId,
    });
    expect(checkpoint).toMatchObject({ revision: 2n, pendingAction: null });
    expect(database.queries[0]?.values).toEqual([
      positionId,
      "position_runtime",
      "1",
      action.deliveryId,
    ]);
  });

  it("rejects malformed persisted type tags", async () => {
    const database = new ScriptedDatabase();
    const malformed = row(0n, null);
    malformed.payload_json = { $type: "bigint", value: "not-an-integer" };
    database.responses.push(result([malformed]));
    const repository = new PostgresPositionWorkerCheckpointRepository(database);
    await expect(repository.load(positionId)).rejects.toThrow("invalid type tag");
  });
});
