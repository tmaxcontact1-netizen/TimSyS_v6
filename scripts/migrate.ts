import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

import { Pool, type PoolClient } from "pg";

export interface MigrationFile {
  readonly name: string;
  readonly checksum: string;
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
  for (let index = 0; index < names.length; index += 1) {
    const expected = String(index + 1).padStart(4, "0");
    if (!names[index]?.startsWith(`${expected}_`))
      throw new Error(`Migration sequence is incomplete at ${expected}`);
  }
  return Promise.all(
    names.map(async (name) => {
      const sql = await readFile(resolve(directory, name), "utf8");
      return Object.freeze({
        name,
        sql,
        checksum: createHash("sha256").update(sql).digest("hex"),
      });
    }),
  );
}

export async function applyMigrations(
  client: MigrationClient,
  files: readonly MigrationFile[],
): Promise<readonly string[]> {
  await client.query("SELECT pg_advisory_lock(hashtextextended('memecoined-migrations', 0))");
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
      if (file.checksum !== checksum) throw new Error(`Applied migration ${name} was modified`);
    }
    const completed: string[] = [];
    for (const file of files) {
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
    await client.query("SELECT pg_advisory_unlock(hashtextextended('memecoined-migrations', 0))");
  }
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_MIGRATION_URL;
  if (connectionString === undefined)
    throw new Error("DATABASE_MIGRATION_URL is required for migration execution");
  if (connectionString === process.env.DATABASE_URL)
    throw new Error("Migration and runtime database credentials must be different");
  const pool = new Pool({
    connectionString,
    max: 1,
    ...(process.env.MEMECOINED_ENV === "production" ? { ssl: { rejectUnauthorized: true } } : {}),
  });
  try {
    const client: PoolClient = await pool.connect();
    try {
      const files = await loadMigrationFiles(resolve(process.cwd(), "migrations"));
      const applied = await applyMigrations(client, files);
      process.stdout.write(`${JSON.stringify({ event: "migrations_applied", applied })}\n`);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

if (process.argv[1] !== undefined && import.meta.url === new URL(process.argv[1], "file:").href) {
  main().catch((error: unknown) => {
    process.stderr.write(
      `${JSON.stringify({ event: "migration_failed", message: error instanceof Error ? error.message : "Unknown failure" })}\n`,
    );
    process.exitCode = 1;
  });
}
