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
];

function database(missing?: string) {
  return {
    query: async (sql: string) =>
      sql.startsWith("SHOW")
        ? { rows: [{ server_version: "18.4" }] }
        : {
            rows: columns
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
});
