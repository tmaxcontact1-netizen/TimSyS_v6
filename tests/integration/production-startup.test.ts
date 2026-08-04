import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { installShutdownSignals, runProductionProcess } from "../../src/entrypoints/main.js";

const required = [
  "audit_events.id",
  "jobs.id",
  "jobs.payload_json",
  "jobs.state",
  "jobs.available_at",
  "jobs.version",
  "jobs.last_error_json",
  "jobs.last_error_at",
  "position_runtime_facts.id",
  "position_runtime_facts.position_id",
  "position_runtime_facts.checkpoint_revision",
  "position_runtime_facts.phase",
  "position_runtime_facts.payload_json",
  "position_observations.id",
  "position_observations.position_id",
  "position_observations.content_hash",
  "position_observations.payload_json",
  "position_runtime_fact_observations.runtime_fact_id",
  "position_runtime_fact_observations.observation_id",
  "position_runtime_contexts.position_id",
  "position_runtime_contexts.token_id",
  "position_runtime_contexts.wallet",
  "position_runtime_contexts.token_mint",
  "position_runtime_contexts.settlement_mint",
  "position_runtime_authority_snapshots.id",
  "position_runtime_authority_snapshots.position_id",
  "position_runtime_authority_snapshots.checkpoint_revision",
  "position_runtime_authority_snapshots.phase",
  "position_runtime_authority_snapshots.authority_kind",
  "position_runtime_authority_snapshots.payload_json",
];
function database(schemaReady = true) {
  const end = vi.fn(async () => undefined);
  return {
    end,
    query: vi.fn(async (sql: string) =>
      sql.startsWith("SHOW")
        ? { rows: [{ server_version: "18.4" }] }
        : {
            rows: (schemaReady ? required : []).map((value) => {
              const [table_name, column_name] = value.split(".");
              return { table_name, column_name };
            }),
          },
    ),
  };
}

describe("production process lifecycle", () => {
  it("validates the database before startup recovery", async () => {
    const db = database(false);
    const recoverAbandoned = vi.fn();
    await expect(
      runProductionProcess({
        config: {} as never,
        database: db as never,
        supervisor: {
          jobs: { recoverAbandoned, findDue: vi.fn() },
          now: () => "2026-08-04T00:00:00.000Z" as never,
          run: vi.fn(),
          wait: { wait: vi.fn() },
          signal: new AbortController().signal,
        },
      }),
    ).rejects.toThrow(/schema is incomplete/);
    expect(recoverAbandoned).not.toHaveBeenCalled();
    expect(db.end).toHaveBeenCalledOnce();
  });
  it("closes the pool after an already-requested shutdown", async () => {
    const db = database();
    const controller = new AbortController();
    controller.abort();
    const result = await runProductionProcess({
      config: {} as never,
      database: db as never,
      supervisor: {
        jobs: {} as never,
        now: vi.fn(),
        run: vi.fn(),
        wait: {} as never,
        signal: controller.signal,
      },
    });
    expect(result.supervisor.batchesCompleted).toBe(0);
    expect(db.end).toHaveBeenCalledOnce();
  });
  it("translates SIGTERM into cooperative abort and removes handlers", () => {
    const emitter = new EventEmitter();
    const controller = new AbortController();
    const remove = installShutdownSignals(controller, emitter as never);
    emitter.emit("SIGTERM");
    expect(controller.signal.aborted).toBe(true);
    remove();
    expect(emitter.listenerCount("SIGINT")).toBe(0);
  });
});
