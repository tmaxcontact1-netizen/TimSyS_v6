import { access, readFile, readdir, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stageArgument=process.argv.find(v=>v.startsWith("--stage-dir="));
const stage=stageArgument?resolve(stageArgument.slice(12)):join(root,"apps","launcher","runtime-stage");
const failures = [];
const execFileAsync = promisify(execFile);

async function requirePath(relative) {
  try {
    await access(join(stage, relative), constants.R_OK);
  } catch {
    failures.push(`missing staged path: ${relative}`);
  }
}

async function digest(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

async function inventory(directory, prefix = "") {
  const result = new Map();
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if(["node_modules","modules-runtime","data",".git"].includes(entry.name)||(entry.name==="app-adapters"&&directory.endsWith("ai_gateway")))continue;
    const relative = prefix ? join(prefix, entry.name) : entry.name;
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) {
      for (const [name, hash] of await inventory(absolute, relative)) result.set(name, hash);
    } else if (entry.isFile()) result.set(relative, await digest(absolute));
  }
  return result;
}

async function verifyCurrent(relative, stagedRelative = relative) {
  try {
    const source = join(root, relative), staged = join(stage, stagedRelative);
    const sourceStat = await stat(source), stagedStat = await stat(staged);
    if (sourceStat.isFile() !== stagedStat.isFile() || sourceStat.isDirectory() !== stagedStat.isDirectory()) throw new Error("path kinds differ");
    if (sourceStat.isFile()) {
      if (await digest(source) !== await digest(staged)) failures.push(`staged file differs from source: ${stagedRelative}`);
      return;
    }
    const expected = await inventory(source), actual = await inventory(staged);
    const names = new Set([...expected.keys(), ...actual.keys()]);
    const changed = [...names].filter((name) => expected.get(name) !== actual.get(name));
    if (changed.length) failures.push(`staged tree differs from source: ${stagedRelative} (${changed.slice(0, 5).join(", ")}${changed.length > 5 ? ", …" : ""})`);
  } catch (error) {
    failures.push(`unable to verify staged source ${stagedRelative}: ${error.message}`);
  }
}

async function verifyNodeRuntime(relative, packages) {
  const modulesRoot = join(stage, relative);
  for (const packageName of packages) {
    try {
      await execFileAsync(process.execPath, ["-e", `require(${JSON.stringify(packageName)})`], {
        env: { ...process.env, NODE_PATH: modulesRoot },
        windowsHide: true,
      });
    } catch (error) {
      failures.push(
        `staged runtime cannot load ${packageName} from ${relative}: ${error.stderr?.trim() || error.message}`,
      );
    }
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
  if (manifest.schemaVersion !== 1 || !["supervised-child","frontend"].includes(manifest.kind)) {
    failures.push(`unsupported staged manifest contract: ${relative}`);
  }
  if (manifest.health?.contract === "timsys.application.v1" && manifest.platform?.protocol !== manifest.health.contract) {
    failures.push(`platform and health contracts disagree: ${relative}`);
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
  requirePath("platform/services/tradeed/modules-runtime/pg/package.json"),
  requirePath("platform/services/tradeed/modules-runtime/@timsys/app-sdk/package.json"),
  requirePath("apps/tradeed/frontend/index.html"),
  requirePath("apps/tradeed/frontend/app.js"),
  requirePath("platform/services/tradeed/.env.example"),
  requirePath("platform/services/dressed/modules-runtime/pg/package.json"),
  requirePath("platform/services/dressed/modules-runtime/@timsys/app-sdk/package.json"),
  requirePath("platform/modules-runtime/sharp/package.json"),
  requirePath("apps/dressed/dist/frontend/index.html"),
  requirePath("platform/services/dressed/.env.example"),
  requirePath("platform/services/researched/modules-runtime/pg/package.json"),
  requirePath("platform/services/researched/modules-runtime/@timsys/app-sdk/package.json"),
  requirePath("apps/researched/dist/frontend/index.html"),
  requirePath("platform/services/researched/.env.example"),
  requirePath("runtime/postgres/bin/postgres.exe"),
  requirePath("runtime/postgres/bin/pg_dump.exe"),
  requirePath("runtime/postgres/share/timezone"),
  requirePath("runtime/postgres/share/timezonesets/Default"),
  verifyManifest("platform/timsys.app.json"),
  verifyManifest("apps/tradeed/timsys.app.json"),
  ...["dressed","researched","tradeed"].map(app=>verifyManifest("platform/services/"+app+"/timsys.app.json")),
  verifyManifest("apps/dressed/timsys.app.json"),
  verifyManifest("apps/researched/timsys.app.json"),
]);

await Promise.all([
  verifyNodeRuntime("platform/modules-runtime", ["better-sqlite3", "jsonwebtoken", "zod", "pg", "sharp"]),
  verifyNodeRuntime("platform/services/tradeed/modules-runtime", ["@timsys/app-sdk", "pg", "zod"]),
  verifyNodeRuntime("platform/services/dressed/modules-runtime", ["@timsys/app-sdk", "pg", "zod"]),
  verifyNodeRuntime("platform/services/researched/modules-runtime", ["@timsys/app-sdk", "pg", "zod"]),
]);

await Promise.all(["principaled","dressed","researched","tradeed"].map(app=>verifyCurrent("apps/"+app+"/ai-adapter.json","platform/modules/ai_gateway/app-adapters/"+app+".json")));
const adapterNames=(await readdir(join(stage,"platform/modules/ai_gateway/app-adapters"))).sort();if(adapterNames.join(",")!==["dressed.json","principaled.json","researched.json","tradeed.json"].join(","))failures.push("Unexpected staged app adapter inventory");
await Promise.all([
  ...["package.json","package-lock.json","index.js","timsys.app.json","config","contracts","engine","frontend","migrations","modules","packages","scripts","services","native","shared"].map((item) => verifyCurrent(`platform/${item}`)),
  ...["frontend","timsys.app.json","timsys.services.json"].map((item) => verifyCurrent(`apps/tradeed/${item}`)),
  verifyCurrent("apps/principaled/dist"),
  ...["dist/frontend","timsys.app.json","timsys.services.json"].map((item) => verifyCurrent(`apps/dressed/${item}`)),
  ...["dist/frontend","timsys.app.json","timsys.services.json"].map((item) => verifyCurrent(`apps/researched/${item}`)),
  ...["bin", "lib", "share", "server_license.txt", "commandlinetools_3rd_party_licenses.txt"]
    .map((item) => verifyCurrent(`apps/launcher/.cache/postgres/${item}`, `runtime/postgres/${item}`)),
]);

async function verifyMigrations(application, displayName) {
 try {
  const sourceMigrations = (
    await readdir(join(root, ...(application === "dressed" ? ["platform","services","wardrobe","migrations"] : ["platform","services",application,"migrations"])))
  )
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
  const stagedMigrations = (
    await readdir(join(stage, ...(application === "dressed" ? ["platform","services","wardrobe","migrations"] : ["platform","services",application,"migrations"])))
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

try {
  const baseline = JSON.parse(await readFile(join(stage, 'platform/installed-baseline.json'), 'utf8'));
  if (baseline.schemaVersion !== 1) failures.push('Unsupported installed baseline metadata');
  for (const app of ['principaled', 'dressed', 'researched', 'tradeed']) {
    for (const file of ['package.json', 'timsys.app.json', 'ai-adapter.json', 'ai-assistant-contract.json']) {
      const relative = `apps/${app}/${file}`;
      try { await access(join(root, relative)); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
      await verifyCurrent(relative);
    }
    if (app !== 'principaled') {
      const appPackage = JSON.parse(await readFile(join(stage, 'apps', app, 'package.json'), 'utf8'));
      if (baseline.bundles?.[app]?.version !== appPackage.version) failures.push(`Installed baseline disagrees with ${app} package version`);
    }
  }
} catch (error) { failures.push(`Installed baseline/package metadata verification failed: ${error.message}`); }

await Promise.all([
  verifyMigrations("tradeed", "TradeEd"),
  verifyMigrations("dressed", "Dress'Ed"),
  verifyMigrations("researched", "Research'Ed"),
]);

if (failures.length > 0) {
  process.stderr.write(
    `Windows runtime verification failed:\n- ${failures.join("\n- ")}\n`,
  );
  process.exit(1);
}
process.stdout.write(
  "Windows runtime verified: launcher, platform, TradeEd, Dress'Ed, Research'Ed, PostgreSQL, migrations, and production dependencies are staged.\n",
);


