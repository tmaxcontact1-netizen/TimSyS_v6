import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { applyMigrations, loadMigrationFiles } from "../../scripts/migrate.js";

describe("migration execution", () => {
  it("loads a complete ordered immutable migration sequence", async () => {
    const directory = await mkdtemp(join(tmpdir(), "memecoined-migrations-"));
    await writeFile(join(directory, "0002_second.sql"), "SELECT 2;");
    await writeFile(join(directory, "0001_first.sql"), "SELECT 1;");
    const files = await loadMigrationFiles(directory);
    expect(files.map((file) => file.name)).toEqual(["0001_first.sql", "0002_second.sql"]);
    expect(files[0]?.checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects sequence gaps while retaining reserved no-op slots", async () => {
    const gap = await mkdtemp(join(tmpdir(), "memecoined-migration-gap-"));
    await writeFile(join(gap, "0002_second.sql"), "SELECT 2;");
    await expect(loadMigrationFiles(gap)).rejects.toThrow(/incomplete/);
    const reserved = await mkdtemp(join(tmpdir(), "memecoined-migration-reserved-"));
    await writeFile(join(reserved, "0001_reserved.sql"), "");
    await expect(loadMigrationFiles(reserved)).resolves.toHaveLength(1);
  });

  it("rejects checksum drift and always releases its lock", async () => {
    const queries: string[] = [];
    const client = {
      query: async (sql: string) => {
        queries.push(sql);
        return sql.startsWith("SELECT name")
          ? { rows: [{ name: "0001_first.sql", checksum: "a".repeat(64) }], rowCount: 1 }
          : { rows: [], rowCount: 0 };
      },
    };
    await expect(
      applyMigrations(client as never, [
        { name: "0001_first.sql", checksum: "b".repeat(64), sql: "SELECT 1;" },
      ]),
    ).rejects.toThrow(/modified/);
    expect(queries.at(-1)).toContain("pg_advisory_unlock");
  });
});
