import { access, readFile, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, isAbsolute, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stage = join(root, "apps", "launcher", "runtime-stage");
const failures = [];

async function requirePath(relative) {
  try {
    await access(join(stage, relative), constants.R_OK);
  } catch {
    failures.push(`missing staged path: ${relative}`);
  }
}

function safeRelativePath(value) {
  if (typeof value !== "string" || value.length === 0) return false;
  const normalized = normalize(value);
  return (
    !isAbsolute(value) &&
    !normalized.startsWith(`..${sep}`) &&
    normalized !== ".."
  );
}

async function verifyManifest(relative) {
  const manifestFile = join(stage, relative);
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestFile, "utf8"));
  } catch (error) {
    failures.push(`invalid staged manifest ${relative}: ${error.message}`);
    return;
  }
  if (manifest.schemaVersion !== 1 || manifest.kind !== "supervised-child") {
    failures.push(`unsupported staged manifest contract: ${relative}`);
  }
  const appRoot = dirname(manifestFile);
  for (const [name, process] of Object.entries(manifest.processes ?? {})) {
    if (
      process.command !== "node" ||
      !Array.isArray(process.arguments) ||
      process.arguments.length < 1
    ) {
      failures.push(
        `${relative} process ${name} is not a packaged Node entrypoint`,
      );
      continue;
    }
    for (const argument of process.arguments.filter(
      (value) => typeof value === "string" && value.endsWith(".js"),
    )) {
      if (!safeRelativePath(argument))
        failures.push(
          `${relative} process ${name} escapes its application root`,
        );
      else await requirePath(join(dirname(relative), argument));
    }
  }
}

await Promise.all([
  requirePath("platform/modules-runtime"),
  requirePath("apps/memecoined/modules-runtime/pg/package.json"),
  requirePath("apps/memecoined/frontend/index.html"),
  requirePath("apps/memecoined/frontend/app.js"),
  requirePath("apps/memecoined/.env.example"),
  requirePath("apps/dressed/modules-runtime/pg/package.json"),
  requirePath("apps/dressed/modules-runtime/sharp/package.json"),
  requirePath("apps/dressed/dist/frontend/index.html"),
  requirePath("apps/dressed/.env.example"),
  requirePath("runtime/postgres/bin/postgres.exe"),
  requirePath("runtime/postgres/bin/pg_dump.exe"),
  verifyManifest("platform/timsys.app.json"),
  verifyManifest("apps/memecoined/timsys.app.json"),
  verifyManifest("apps/dressed/timsys.app.json"),
]);

async function verifyMigrations(application, displayName) {
 try {
  const sourceMigrations = (
    await readdir(join(root, "apps", application, "migrations"))
  )
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
  const stagedMigrations = (
    await readdir(join(stage, "apps", application, "migrations"))
  )
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
  if (
    sourceMigrations.length === 0 ||
    sourceMigrations.length !== stagedMigrations.length ||
    sourceMigrations.some((name, index) => name !== stagedMigrations[index])
  ) {
    failures.push(
      `staged ${displayName} migrations differ from source (source latest ${sourceMigrations.at(-1) ?? "none"}; staged latest ${stagedMigrations.at(-1) ?? "none"})`,
    );
  }
} catch (error) {
  failures.push(`unable to enumerate ${displayName} migrations: ${error.message}`);
 }
}

await Promise.all([
  verifyMigrations("memecoined", "MemeCoined"),
  verifyMigrations("dressed", "Dress'Ed"),
]);

if (failures.length > 0) {
  process.stderr.write(
    `Windows runtime verification failed:\n- ${failures.join("\n- ")}\n`,
  );
  process.exit(1);
}
process.stdout.write(
  "Windows runtime verified: launcher, platform, MemeCoined, Dress'Ed, PostgreSQL, migrations, and production dependencies are staged.\n",
);
