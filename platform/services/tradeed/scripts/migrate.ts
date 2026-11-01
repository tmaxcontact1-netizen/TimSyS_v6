import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { Pool, type PoolClient } from "pg";

import { resolveApplicationRoot } from "../src/infrastructure/runtime/application-root.js";
import { runtimePoolConfig } from "../src/infrastructure/database/pool.js";

export interface MigrationFile {
  readonly name: string;
  readonly checksum: string;
  readonly compatibleChecksums?: readonly string[];
  readonly sql: string;
}

export interface MigrationClient {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ readonly rows: readonly Row[]; readonly rowCount: number | null }>;
}

const migrationName = /^\d{4}_[a-z0-9_]+\.sql$/;

function transactionalBody(file: MigrationFile): string {
  const trimmed = file.sql.trim();
  if (trimmed.length === 0) return "";
  const match = /^BEGIN;\s*([\s\S]*?)\s*COMMIT;$/i.exec(trimmed);
  if (match?.[1] === undefined)
    throw new Error(`Migration ${file.name} must have one outer BEGIN/COMMIT boundary`);
  return match[1];
}

export async function loadMigrationFiles(directory: string): Promise<readonly MigrationFile[]> {
  const names = (await readdir(directory)).filter((name) => migrationName.test(name)).sort();
  if (names.length === 0) throw new Error("No migration files were found");
  // These independently published histories both used slot 0066. Keep their
  // original names/checksums so either existing ledger can adopt the other.
  const parallel66 = new Set([
    "0066_release_next_conviction.sql",
    "0066_tradeed_segments_exchange_data.sql",
  ]);
  let next = 1;
  for (let index = 0; index < names.length; index += 1) {
    const name = names[index]!;
    const ordinal = Number(name.slice(0, 4));
    if (ordinal === next) { next += 1; continue; }
    if (ordinal === 66 && next === 67 && parallel66.has(name) && parallel66.has(names[index - 1]!)) continue;
    throw new Error(`Migration sequence is incomplete at ${String(next).padStart(4, "0")}`);
  }
  return Promise.all(
    names.map(async (name) => {
      const sql = await readFile(resolve(directory, name), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const lf = sql.replace(/\r\n/g, "\n");
      const serializations = [lf, lf.replace(/\n/g, "\r\n")];
      return Object.freeze({
        name,
        sql,
        checksum,
        compatibleChecksums: Object.freeze(
          [...new Set(serializations.map(value => createHash("sha256").update(value).digest("hex")))].filter(value => value !== checksum),
        ),
      });
    }),
  );
}

export async function applyMigrations(
  client: MigrationClient,
  files: readonly MigrationFile[],
): Promise<readonly string[]> {
  await client.query("SELECT pg_advisory_lock(hashtextextended('tradeed-migrations', 0))");
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      checksum text NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'),
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const applied = await client.query<{ readonly name: string; readonly checksum: string }>(
      "SELECT name, checksum FROM schema_migrations ORDER BY name",
    );
    const known = new Map(applied.rows.map((row) => [row.name, row.checksum]));
    for (const [name, checksum] of known) {
      const file = files.find((candidate) => candidate.name === name);
      if (file === undefined) throw new Error(`Applied migration ${name} is missing from disk`);
      if (
        file.checksum !== checksum &&
        !(file.compatibleChecksums ?? []).includes(checksum)
      )
        throw new Error(`Applied migration ${name} was modified`);
    }
    // The immutable conviction migration inserts its dormant profile for existing
    // wallets. Its separately recorded compatibility prerequisite must run first.
    const bridge = files.find(file => file.name === "0067_conviction_profile_compatibility.sql");
    const ordered = files.filter(file => file !== bridge);
    const conviction = ordered.findIndex(file => file.name === "0066_release_next_conviction.sql");
    if (bridge) ordered.splice(conviction < 0 ? ordered.length : conviction, 0, bridge);
    const completed: string[] = [];
    for (const file of ordered) {
      if (known.has(file.name)) continue;
      await client.query("BEGIN");
      try {
        const body = transactionalBody(file);
        if (body.length > 0) await client.query(body);
        await client.query("INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)", [
          file.name,
          file.checksum,
        ]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
      completed.push(file.name);
    }
    return Object.freeze(completed);
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtextextended('tradeed-migrations', 0))");
  }
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_MIGRATION_URL;
  if (connectionString === undefined)
    throw new Error("DATABASE_MIGRATION_URL is required for migration execution");
  if (connectionString === process.env.DATABASE_URL)
    throw new Error("Migration and runtime database credentials must be different");
  const pool = new Pool(
    runtimePoolConfig({
      connectionString,
      production: process.env.TRADEED_ENV === "production",
      managedLocal: process.env.TRADEED_MANAGED_DATABASE === "1",
      maximumConnections: 1,
    }),
  );
  try {
    const client: PoolClient = await pool.connect();
    try {
      const files = await loadMigrationFiles(
        resolve(resolveApplicationRoot(process.env), "migrations"),
      );
      const applied = await applyMigrations(client, files);
      process.stdout.write(`${JSON.stringify({ event: "migrations_applied", applied })}\n`);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    process.stderr.write(
      `${JSON.stringify({ event: "migration_failed", message: error instanceof Error ? error.message : "Unknown failure" })}\n`,
    );
    process.exitCode = 1;
  });
}
