import { createHash } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { applyMigrations, loadMigrationFiles } from "../../scripts/migrate.js";

describe("merged immutable migration histories", () => {
  it.each(["0066_release_next_conviction.sql", "0066_tradeed_segments_exchange_data.sql"])("adopts the other branch without replaying %s", async existing => {
    const files = await loadMigrationFiles(resolve(import.meta.dirname, "../../migrations"));
    const bridge = files.find(file => file.name === "0067_conviction_profile_compatibility.sql")!;
    const history = files.filter(file => file !== bridge && (!file.name.startsWith("0066_") || file.name === existing));
    const statements: string[] = [];
    const client = { query: async (sql: string) => {
      statements.push(sql);
      return sql.startsWith("SELECT name") ? { rows: history.map(file => ({ name: file.name, checksum: file.checksum })), rowCount: history.length } : { rows: [], rowCount: 0 };
    } };
    const pending = files.find(file => file.name.startsWith("0066_") && file.name !== existing)!;
    await expect(applyMigrations(client as never, files)).resolves.toEqual([bridge.name, pending.name]);
    expect(statements.some(sql => sql.includes(pending.sql.trim().replace(/^BEGIN;\s*/, "").replace(/\s*COMMIT;$/, "")))).toBe(true);
    expect(statements.some(sql => sql.includes(files.find(file => file.name === existing)!.sql.trim()))).toBe(false);
  });
  it("records the compatibility prerequisite before the immutable conviction migration", async () => {
    const files = await loadMigrationFiles(resolve(import.meta.dirname, "../../migrations"));
    const client = { query: async () => ({ rows: [], rowCount: 0 }) };
    const applied = await applyMigrations(client as never, files);
    expect(applied.indexOf("0067_conviction_profile_compatibility.sql")).toBeLessThan(applied.indexOf("0066_release_next_conviction.sql"));
    expect(applied.indexOf("0065_hypothesis_spread_telemetry.sql")).toBeLessThan(applied.indexOf("0067_conviction_profile_compatibility.sql"));
  });
  it("still rejects unrelated duplicate ordinals", async () => {
    const root = await mkdtemp(join(tmpdir(), "tradeed-duplicate-migration-"));
    await writeFile(join(root, "0001_first.sql"), "BEGIN; SELECT 1; COMMIT;");
    await writeFile(join(root, "0001_other.sql"), "BEGIN; SELECT 2; COMMIT;");
    await expect(loadMigrationFiles(root)).rejects.toThrow(/incomplete/);
  });
  it("recognises both exact historical newline serializations", async () => {
    const root = await mkdtemp(join(tmpdir(), "tradeed-newline-migration-"));
    const sql = "BEGIN;\nSELECT 1;\nCOMMIT;\n";
    await writeFile(join(root, "0001_first.sql"), sql);
    const [file] = await loadMigrationFiles(root);
    expect(file!.compatibleChecksums).toContain(createHash("sha256").update(sql.replace(/\n/g, "\r\n")).digest("hex"));
  });
});
