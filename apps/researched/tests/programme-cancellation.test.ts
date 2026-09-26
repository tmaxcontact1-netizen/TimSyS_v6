import { describe, expect, it } from "vitest";
import { ResearchRepository } from "../src/infrastructure/repository.js";

describe("programme capture cancellation", () => {
  it("cancels every unfinished capture for one workflow", async () => {
    const calls: Array<{ sql: string; values: unknown[] }> = [];
    const repository = new ResearchRepository({
      query: async (sql: string, values: unknown[]) => {
        calls.push({ sql, values });
        return { rows: [{ id: "job-1" }, { id: "job-2" }], rowCount: 2 };
      },
    } as any);

    await expect(
      repository.cancelProgrammeCaptures("study-1", "2026-09-26T12:00:00.000Z"),
    ).resolves.toEqual({ cancelled: 2 });
    expect(calls[0]!.sql).toContain("status IN('queued','running','failed')");
    expect(calls[0]!.values).toEqual(["study-1", "2026-09-26T12:00:00.000Z"]);
  });

  it("does not save a result after cancellation wins the race", async () => {
    const statements: string[] = [];
    const client = {
      query: async (sql: string) => {
        statements.push(sql);
        return sql.startsWith("SELECT status")
          ? { rows: [{ status: "cancelled" }], rowCount: 1 }
          : { rows: [], rowCount: 0 };
      },
      release: () => undefined,
    };
    const repository = new ResearchRepository({
      query: client.query,
      connect: async () => client,
    } as any);

    await expect(
      repository.completeProgrammeCapture({ id: "job-1" }, {}, "now"),
    ).resolves.toBe(false);
    expect(statements).toEqual([
      "BEGIN",
      "SELECT status FROM researched.programme_capture_jobs WHERE id=$1 FOR UPDATE",
      "ROLLBACK",
    ]);
  });
});
