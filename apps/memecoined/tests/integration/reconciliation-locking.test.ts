import type { PoolClient, QueryResult } from "pg";
import { describe, expect, it } from "vitest";

import { asTimestamp, asUuid, type PositionId } from "../../src/domain/shared/types.js";
import { PostgresReconciliationJobStore } from "../../src/infrastructure/database/job-store.js";

const positionId = asUuid<PositionId>("00000000-0000-4000-8000-000000000961");
const now = asTimestamp("2026-08-04T15:00:00Z");

class SessionDatabase {
  public readonly queries: Array<{ text: string; values: readonly unknown[] }> = [];
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
    return (this.responses.shift() ?? { rows: [], rowCount: null }) as QueryResult<Row>;
  }
}

function result(rows: Record<string, unknown>[]): QueryResult<Record<string, unknown>> {
  return { rows, rowCount: rows.length } as QueryResult<Record<string, unknown>>;
}

function dueJob(attempts = 0) {
  return { attempts, state: "completed", available_at: "2026-08-04T14:59:59Z" };
}

describe("PostgreSQL reconciliation job locking", () => {
  it("returns due available jobs in database order", async () => {
    const database = new SessionDatabase();
    database.responses.push(
      result([{ id: positionId, attempts: 2, state: "available", available_at: now }]),
    );
    const store = new PostgresReconciliationJobStore(database);
    await expect(store.findDue({ now, limit: 10 })).resolves.toEqual([
      { positionId, availableAt: now, failedAttempts: 2 },
    ]);
    expect(database.queries[0]?.text).toContain("state = 'available'");
    expect(database.released).toBe(true);
  });

  it("atomically reclaims expired row leases", async () => {
    const database = new SessionDatabase();
    database.responses.push(result([]), result([{ id: positionId }]), result([]));
    const store = new PostgresReconciliationJobStore(database);
    await expect(store.recoverAbandoned({ now, limit: 10 })).resolves.toEqual([positionId]);
    expect(database.queries.map(({ text }) => text.trim())).toEqual([
      "BEGIN",
      expect.stringContaining("FOR UPDATE SKIP LOCKED"),
      "COMMIT",
    ]);
    expect(database.released).toBe(true);
  });

  it("returns locked and releases its session when another worker owns the advisory lock", async () => {
    const database = new SessionDatabase();
    database.responses.push(result([{ locked: false }]));
    const store = new PostgresReconciliationJobStore(database);
    await expect(store.tryAcquire({ positionId, ownerId: "worker-a", now })).resolves.toBeNull();
    expect(database.released).toBe(true);
    expect(database.queries).toHaveLength(1);
  });

  it("holds the same database session after acquiring a due job", async () => {
    const database = new SessionDatabase();
    database.responses.push(result([{ locked: true }]), result([dueJob(2)]));
    const store = new PostgresReconciliationJobStore(database);
    await expect(store.tryAcquire({ positionId, ownerId: "worker-a", now })).resolves.toEqual({
      positionId,
      ownerId: "worker-a",
      failedAttempts: 2,
    });
    expect(database.released).toBe(false);
  });

  it("atomically schedules the next attempt and releases the advisory lock", async () => {
    const database = new SessionDatabase();
    database.responses.push(
      result([{ locked: true }]),
      result([dueJob(1)]),
      result([{}]),
      result([{}]),
    );
    const store = new PostgresReconciliationJobStore(database);
    const lease = await store.tryAcquire({ positionId, ownerId: "worker-a", now });
    const availableAt = asTimestamp("2026-08-04T15:00:02Z");
    await store.retry(lease!, availableAt, {
      stage: "transaction",
      code: "unavailable",
      reason: "offline",
      occurredAt: now,
    });
    expect(database.queries[2]?.text).toContain("last_error_json");
    expect(database.queries[2]?.text).toContain("reconciliation_failure_events");
    expect(database.queries[2]?.values.slice(0, 6)).toEqual([
      positionId,
      "position_runtime",
      "available",
      1,
      availableAt,
      1,
    ]);
    expect(database.queries[3]?.text).toContain("pg_advisory_unlock");
    expect(database.released).toBe(true);
  });

  it("reschedules successful non-terminal work without incrementing attempts", async () => {
    const database = new SessionDatabase();
    database.responses.push(
      result([{ locked: true }]),
      result([dueJob(1)]),
      result([{}]),
      result([{}]),
    );
    const store = new PostgresReconciliationJobStore(database);
    const lease = await store.tryAcquire({ positionId, ownerId: "worker-a", now });
    const availableAt = asTimestamp("2026-08-04T15:00:05Z");
    await store.reschedule(lease!, availableAt);
    expect(database.queries[2]?.values.slice(0, 6)).toEqual([
      positionId,
      "position_runtime",
      "available",
      0,
      availableAt,
      1,
    ]);
  });

  it("releases the lock even when durable completion conflicts", async () => {
    const database = new SessionDatabase();
    database.responses.push(
      result([{ locked: true }]),
      result([dueJob()]),
      result([]),
      result([{}]),
    );
    const store = new PostgresReconciliationJobStore(database);
    const lease = await store.tryAcquire({ positionId, ownerId: "worker-a", now });
    await expect(store.complete(lease!)).rejects.toThrow("concurrency conflict");
    expect(database.queries.at(-1)?.text).toContain("pg_advisory_unlock");
    expect(database.released).toBe(true);
  });

  it("rejects a forged lease and still releases the actually held lock", async () => {
    const database = new SessionDatabase();
    database.responses.push(result([{ locked: true }]), result([dueJob()]), result([{}]));
    const store = new PostgresReconciliationJobStore(database);
    const lease = await store.tryAcquire({ positionId, ownerId: "worker-a", now });
    await expect(store.complete({ ...lease!, failedAttempts: 1 })).rejects.toThrow(
      "does not match",
    );
    expect(database.queries).toHaveLength(3);
    expect(database.queries.at(-1)?.text).toContain("pg_advisory_unlock");
    expect(database.released).toBe(true);
  });
});
