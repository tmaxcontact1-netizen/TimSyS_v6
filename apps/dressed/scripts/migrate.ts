import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import pg from "pg";

import { loadConfig } from "../src/infrastructure/config/load-config.js";

const MIGRATION = /^\d{4}_[a-z0-9_]+\.sql$/;

export async function migrate(input: {
  readonly connectionString: string;
  readonly migrationDirectory: string;
}): Promise<readonly string[]> {
  const client = new pg.Client({ connectionString: input.connectionString });
  await client.connect();
  const applied: string[] = [];
  try {
    await client.query("SELECT pg_advisory_lock(hashtextextended('dressed-migrations', 0))");
    const names = (await readdir(input.migrationDirectory)).filter((name) => MIGRATION.test(name)).sort();
    if (names[0] !== "0000_foundation.sql") throw new Error("Dress'Ed foundation migration is missing");
    for (const name of names) {
      const sql = await readFile(resolve(input.migrationDirectory, name), "utf8");
      const hash = createHash("sha256").update(sql).digest("hex");
      const existing = await client.query<{ content_hash: string }>(
        "SELECT content_hash FROM dressed.dressed_schema_migrations WHERE migration_name=$1",
        [name],
      ).catch((error: unknown) => {
        if (name === "0000_foundation.sql") return { rows: [] };
        throw error;
      });
      const previous = existing.rows[0]?.content_hash;
      if (previous !== undefined) {
        if (previous !== hash) throw new Error(`Applied migration changed: ${name}`);
        continue;
      }
      await client.query(sql);
      await client.query(
        `INSERT INTO dressed.dressed_schema_migrations (migration_name,content_hash)
         VALUES ($1,$2) ON CONFLICT (migration_name) DO NOTHING`,
        [name, hash],
      );
      applied.push(name);
    }
    return Object.freeze(applied);
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock(hashtextextended('dressed-migrations', 0))");
    } finally {
      await client.end();
    }
  }
}

const invoked = process.argv[1];
if (invoked !== undefined && import.meta.url === pathToFileURL(invoked).href) {
  const config = loadConfig(process.env);
  migrate({ connectionString: config.databaseUrl, migrationDirectory: resolve("migrations") })
    .then((names) => process.stdout.write(`Applied ${names.length} Dress'Ed migration(s).\n`))
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : "Migration failed"}\n`);
      process.exitCode = 1;
    });
}
