"use strict";
const fs = require("node:fs/promises"),
  path = require("node:path"),
  crypto = require("node:crypto");
async function migrate(connectionString, runtimeUser) {
  const { Client } = require("pg"),
    client = new Client({
      connectionString,
      connectionTimeoutMillis: 3000,
      statement_timeout: 10000,
    });
  await client.connect();
  const applied = [];
  try {
    const existing=await client.query("SELECT to_regclass('dressed.garments') garments,to_regclass('dressed.dressed_schema_migrations') ledger");
    if(!existing.rows[0].garments||!existing.rows[0].ledger){const error=new Error('Select the existing wardrobe database; automatic empty-wardrobe initialization is disabled');error.code='WARDROBE_DATA_NOT_FOUND';error.status=409;throw error;}
    await client.query(
      "SELECT pg_advisory_lock(hashtextextended('dressed-migrations',0))",
    );
    for (const name of (await fs.readdir(path.join(__dirname, "migrations")))
      .filter((n) => /^\d{4}_[a-z0-9_]+\.sql$/.test(n))
      .sort()) {
      const sql = await fs.readFile(
          path.join(__dirname, "migrations", name),
          "utf8",
        ),
        hash = crypto.createHash("sha256").update(sql).digest("hex");
      const table = await client.query(
        "SELECT to_regclass('dressed.dressed_schema_migrations') name",
      );
      const previous = table.rows[0].name
        ? (
            await client.query(
              "SELECT content_hash FROM dressed.dressed_schema_migrations WHERE migration_name=$1",
              [name],
            )
          ).rows[0]
        : null;
      if (previous) {
        if (previous.content_hash !== hash)
          throw Error("Applied migration changed: " + name);
        continue;
      }
      await client.query("BEGIN");
      try {
        await client.query(
          sql.replace(/^\s*BEGIN\s*;/i, "").replace(/COMMIT\s*;\s*$/i, ""),
        );
        await client.query(
          "INSERT INTO dressed.dressed_schema_migrations(migration_name,content_hash) VALUES($1,$2)",
          [name, hash],
        );
        await client.query("COMMIT");
        applied.push(name);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
    if (runtimeUser) {
      const role = '"' + runtimeUser.replaceAll('"', '""') + '"';
      await client.query(
        `GRANT USAGE ON SCHEMA dressed TO ${role}; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA dressed TO ${role}; GRANT USAGE,SELECT,UPDATE ON ALL SEQUENCES IN SCHEMA dressed TO ${role};`,
      );
    }
    return applied;
  } finally {
    await client
      .query(
        "SELECT pg_advisory_unlock(hashtextextended('dressed-migrations',0))",
      )
      .catch(() => {});
    await client.end();
  }
}
module.exports = { migrate };
