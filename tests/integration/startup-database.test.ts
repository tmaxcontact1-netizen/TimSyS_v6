import { describe, expect, it } from "vitest";
import { runtimePoolConfig } from "../../src/infrastructure/database/pool.js";
import { verifyRuntimeDatabase } from "../../src/infrastructure/database/migrations.js";

const columns = [
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
  "position_runtime_authority_baselines.position_id",
  "position_runtime_authority_baselines.payload_json",
];

const paperColumns = [
  "paper_accounts.wallet",
  "paper_accounts.initial_cash_raw",
  "paper_cash_events.event_type",
  "paper_cash_events.amount_raw",
  "paper_fills.id",
  "paper_fills.side",
  "paper_position_lots.current_amount_raw",
  "paper_position_lots.remaining_cost_raw",
  "paper_entry_executions.risk_run_id",
  "paper_position_work.available_at",
  "paper_position_work.last_error",
  "paper_realized_performance.realized_pnl_raw",
  "paper_exit_evaluations.evaluated_at",
  "dashboard_watchlists.version",
  "dashboard_watchlist_tokens.token_mint",
  "dashboard_mutation_audit.action",
];

function database(missing?: string, includePaper = false) {
  return {
    query: async (sql: string) =>
      sql.startsWith("SHOW")
        ? { rows: [{ server_version: "18.4" }] }
        : {
            rows: [...columns, ...(includePaper ? paperColumns : [])]
              .filter((item) => item !== missing)
              .map((item) => {
                const [table_name, column_name] = item.split(".");
                return { table_name, column_name };
              }),
          },
  };
}

describe("runtime database startup", () => {
  it("builds a bounded production TLS pool", () =>
    expect(
      runtimePoolConfig({ connectionString: "postgresql://secret@example/db", production: true }),
    ).toMatchObject({ max: 10, ssl: { rejectUnauthorized: true } }));
  it("does not mutate the connection string", () =>
    expect(
      runtimePoolConfig({ connectionString: "postgresql://secret@example/db", production: false })
        .connectionString,
    ).toBe("postgresql://secret@example/db"));
  it("rejects excessive connection pools", () =>
    expect(() =>
      runtimePoolConfig({
        connectionString: "postgresql://x",
        production: false,
        maximumConnections: 51,
      }),
    ).toThrow(/between 1 and 50/));
  it("accepts the complete runtime schema", async () =>
    await expect(verifyRuntimeDatabase(database() as never)).resolves.toEqual({
      serverVersion: "18.4",
      schemaReady: true,
    }));
  it("rejects an unapplied reconciliation migration", async () =>
    await expect(verifyRuntimeDatabase(database("jobs.last_error_json") as never)).rejects.toThrow(
      /jobs.last_error_json/,
    ));
  it("rejects an unapplied runtime-authority migration", async () =>
    await expect(
      verifyRuntimeDatabase(database("position_runtime_contexts.wallet") as never),
    ).rejects.toThrow(/position_runtime_contexts.wallet/));
  it("rejects an unapplied runtime-authority baseline migration", async () =>
    await expect(
      verifyRuntimeDatabase(database("position_runtime_authority_baselines.payload_json") as never),
    ).rejects.toThrow(/position_runtime_authority_baselines.payload_json/));
  it("accepts the complete paper runtime schema", async () =>
    await expect(
      verifyRuntimeDatabase(database(undefined, true) as never, "paper"),
    ).resolves.toEqual({
      serverVersion: "18.4",
      schemaReady: true,
    }));
  it("keeps the paper supervisor independent of optional dashboard tables", async () =>
    await expect(
      verifyRuntimeDatabase(database("dashboard_watchlists.version", true) as never, "paper"),
    ).resolves.toEqual({ serverVersion: "18.4", schemaReady: true }));
  it("rejects an unapplied paper authority migration", async () =>
    await expect(
      verifyRuntimeDatabase(
        database("paper_exit_evaluations.evaluated_at", true) as never,
        "paper",
      ),
    ).rejects.toThrow(/paper_exit_evaluations.evaluated_at/));
  it("rejects an unapplied dashboard watchlist migration", async () =>
    await expect(
      verifyRuntimeDatabase(database("dashboard_watchlists.version", true) as never, "paper", true),
    ).rejects.toThrow(/dashboard_watchlists.version/));
});
