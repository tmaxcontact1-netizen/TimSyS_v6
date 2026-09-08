import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceExtensions = new Set([".js", ".jsx", ".ts", ".tsx", ".cjs", ".mjs"]);

async function files(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (["node_modules", "dist", "dist-electron", "runtime-stage"].includes(entry.name)) continue;
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await files(absolute));
    else if (sourceExtensions.has(extname(entry.name))) found.push(absolute);
  }
  return found;
}

function endpointPattern(path) {
  const escaped = path
    .split("?")[0]
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\\$\\\{[^}]+\\\}/g, "[^/?]+")
    .replace(/:[A-Za-z][A-Za-z0-9_]*/g, "[^/?]+");
  return new RegExp(`(?:[\"'\\x60])${escaped}(?:[?\"'\\x60]|$)`);
}

function referenced(path, frontendSource) {
  if (endpointPattern(path).test(frontendSource)) return true;
  if (/^\/api\/(studies|evidence|findings|reports)\/:id$/.test(path))
    return frontendSource.includes('`/api/${kind === "study" ? "studies" : kind}/${id}`');
  return false;
}

function exposure(path) {
  if (/health|manifest|contract|diagnostic|\/application$/.test(path)) return "administration";
  if (/insight|analytic|performance|snapshot|dashboard/.test(path)) return "output";
  return "operational";
}

async function principalCoverage() {
  const frontendFiles = [
    ...await files(join(root, "apps", "principaled", "src")),
    ...await files(join(root, "apps", "launcher", "src")),
  ];
  const frontendSource = (await Promise.all(frontendFiles.map((file) => readFile(file, "utf8")))).join("\n");
  const moduleDirectories = await readdir(join(root, "platform", "modules"), { withFileTypes: true });
  const rows = [];
  for (const entry of moduleDirectories.filter((item) => item.isDirectory())) {
    try {
      const manifest = JSON.parse(await readFile(join(root, "platform", "modules", entry.name, "module.json"), "utf8"));
      for (const route of manifest.routes ?? []) rows.push({
        app: "Principal'Ed",
        owner: manifest.name,
        method: route.method,
        path: route.path,
        exposure: exposure(route.path),
        referenced: referenced(route.path, frontendSource),
      });
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return rows;
}

async function standaloneCoverage(name, apiFile, frontendDirectory, owner) {
  const apiSource = await readFile(join(root, apiFile), "utf8");
  const frontendFiles = await files(join(root, frontendDirectory));
  const frontendSource = (await Promise.all(frontendFiles.map((file) => readFile(file, "utf8")))).join("\n");
  const paths = new Set();
  const matcher = /pathname(?:\.startsWith)?\s*\(??\s*===?\s*["'](\/api\/[^"']+)["']|pathname\.startsWith\(\s*["'](\/api\/[^"']+)["']\s*\)/g;
  for (const match of apiSource.matchAll(matcher)) paths.add(match[1] || match[2]);
  // Standalone apps use either `pathname`/`path` comparisons or anchored
  // regular expressions for parameterised routes. Audit both forms so adding
  // a new routing style cannot silently remove an application from coverage.
  for (const match of apiSource.matchAll(/["'`](\/api\/[^"'`?]+)["'`]/g)) paths.add(match[1]);
  for (const match of apiSource.matchAll(/\/\^((?:\\\/|[^/])+?)\$\/[a-z]*/gi)) {
    let parameter = 0;
    const route = match[1]
      .replaceAll("\\/", "/")
      .replace(/\\[.()[\]{}+*?^$|]/g, (value) => value.slice(1))
      .replace(/\([^)]*\)/g, () => `:${parameter++ === 0 ? "id" : `parameter${parameter}`}`);
    if (route.startsWith("/api/")) paths.add(route);
  }
  return [...paths].sort().map((path) => ({
    app: name,
    owner,
    method: "ANY",
    path,
    exposure: exposure(path),
    referenced: referenced(path, frontendSource),
  }));
}

function section(rows, title) {
  const missing = rows.filter((row) => !row.referenced);
  const operationalMissing = missing.filter((row) => row.exposure === "operational");
  const byOwner = new Map();
  for (const row of rows) {
    const current = byOwner.get(row.owner) ?? { total: 0, connected: 0, missing: 0 };
    current.total += 1;
    current[row.referenced ? "connected" : "missing"] += 1;
    byOwner.set(row.owner, current);
  }
  const lines = [
    `## ${title}`,
    "",
    `Declared capabilities: **${rows.length}**`,
    `Frontend-referenced: **${rows.length - missing.length}**`,
    `Not referenced: **${missing.length}**`,
    `Operational gaps: **${operationalMissing.length}**`,
    "",
    "| Owner | Declared | Referenced | Unreferenced |",
    "|---|---:|---:|---:|",
    ...[...byOwner.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([owner, count]) => `| ${owner} | ${count.total} | ${count.connected} | ${count.missing} |`),
    "",
    "### Unreferenced capabilities",
    "",
    ...(missing.length ? [
      "| Exposure | Method | Endpoint | Owner |",
      "|---|---|---|---|",
      ...missing.map((row) => `| ${row.exposure} | ${row.method} | \`${row.path}\` | ${row.owner} |`),
    ] : ["None."]),
    "",
  ];
  return lines.join("\n");
}

const principal = await principalCoverage();
const dressed = await standaloneCoverage("Dress'Ed", "apps/dressed/src/entrypoints/api.ts", "apps/dressed/frontend", "dressed");
const memecoined = await standaloneCoverage("MemeCoined", "apps/memecoined/src/entrypoints/dashboard.ts", "apps/memecoined/frontend", "memecoined");
const researched = await standaloneCoverage("Research'Ed", "apps/researched/src/entrypoints/api.ts", "apps/researched/frontend", "researched");
const all = [...principal, ...dressed, ...memecoined, ...researched];
const document = [
  "# UI Capability Coverage",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  "This report is a static connection audit. A route is **referenced** when application frontend source contains a matching endpoint. Reference proves an intended UI connection, not that the resulting workflow is usable; interaction acceptance is a later gate.",
  "",
  "Infrastructure-only services are intentionally excluded unless they publish a user-facing HTTP capability. Health, manifest, contract, and diagnostic endpoints are classified as administration rather than ordinary work.",
  "",
  section(principal, "Principal'Ed"),
  section(dressed, "Dress'Ed"),
  section(memecoined, "MemeCoined"),
  section(researched, "Research'Ed"),
  "## Machine-readable totals",
  "",
  "```json",
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    totals: { declared: all.length, referenced: all.filter((row) => row.referenced).length, unreferenced: all.filter((row) => !row.referenced).length },
    applications: Object.fromEntries([principal, dressed, memecoined, researched].map((rows) => [rows[0]?.app, { declared: rows.length, referenced: rows.filter((row) => row.referenced).length }])),
  }, null, 2),
  "```",
  "",
].join("\n");

const destination = join(root, "docs", "UI_CAPABILITY_COVERAGE.md");
await writeFile(destination, document, "utf8");
process.stdout.write(`UI capability coverage written to ${relative(root, destination)}\n`);
