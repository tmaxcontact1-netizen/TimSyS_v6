import { access, cp, mkdir, readdir, rename, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stage = join(root, "apps", "launcher", "runtime-stage");
const npmCli = process.env.npm_execpath || resolve(dirname(process.execPath), "..", "node_modules", "npm", "bin", "npm-cli.js");
const sourceOnly = process.argv.includes("--refresh-source-only");

async function copy(relative, destination = relative) {
  const target = join(stage, destination);
  if (sourceOnly) await rm(target, { recursive: true, force: true });
  await cp(join(root, relative), target, { recursive: true });
}
async function installProduction(directory) {
  try { await access(npmCli); }
  catch {
    const sourceModules = join(root, directory, "node_modules");
    const target = join(stage, directory, "node_modules");
    await mkdir(target, { recursive: true });
    const store = join(sourceModules, ".pnpm");
    let packageFolders;
    try { packageFolders = await readdir(store); }
    catch {
      await rm(target, { recursive: true, force: true });
      await cp(sourceModules, target, { recursive: true, dereference: true, force: true });
      return;
    }
    for (const packageFolder of packageFolders) {
      const packageRoot = join(store, packageFolder, "node_modules");
      let entries;
      try { entries = await readdir(packageRoot, { withFileTypes: true }); } catch { continue; }
      for (const entry of entries) {
        if (entry.name.startsWith("@")) {
          const scopeRoot = join(packageRoot, entry.name);
          for (const child of await readdir(scopeRoot, { withFileTypes: true })) {
            if (!child.isDirectory() && !child.isSymbolicLink()) continue;
            const destination = join(target, entry.name, child.name);
            await mkdir(dirname(destination), { recursive: true });
            await cp(join(scopeRoot, child.name), destination, { recursive: true, dereference: true, force: true });
          }
        } else if (entry.isDirectory() || entry.isSymbolicLink()) {
          await cp(join(packageRoot, entry.name), join(target, entry.name), { recursive: true, dereference: true, force: true });
        }
      }
    }
    return;
  }
  await new Promise((success, failure) => {
    const child = spawn(process.execPath, [npmCli, "ci", "--omit=dev", "--ignore-scripts"], {
      cwd: join(stage, directory), stdio: "inherit", shell: false,
    });
    child.once("error", failure);
    child.once("exit", (code) => code === 0 ? success() : failure(new Error(`Production install failed in ${directory}`)));
  });
}

if (!sourceOnly) await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
for (const item of [
  "platform/package.json", "platform/package-lock.json", "platform/index.js", "platform/timsys.app.json",
  "platform/config", "platform/contracts", "platform/engine", "platform/frontend", "platform/migrations",
  "platform/modules", "platform/scripts", "platform/shared",
  "platform/packages",
]) await copy(item);
for (const item of [
  "apps/memecoined/package.json", "apps/memecoined/package-lock.json", "apps/memecoined/dist",
  "apps/memecoined/frontend", "apps/memecoined/migrations", "apps/memecoined/.env.example",
  "apps/memecoined/timsys.app.json",
]) await copy(item);
await copy("apps/principaled/dist");
for (const item of [
  "apps/dressed/package.json", "apps/dressed/package-lock.json", "apps/dressed/dist",
  "apps/dressed/migrations", "apps/dressed/.env.example", "apps/dressed/timsys.app.json",
]) await copy(item);
for (const item of [
  "apps/researched/package.json", "apps/researched/package-lock.json", "apps/researched/dist",
  "apps/researched/migrations", "apps/researched/.env.example", "apps/researched/timsys.app.json",
]) await copy(item);
if (!sourceOnly) {
  await installProduction("platform");
  await rename(join(stage, "platform", "node_modules"), join(stage, "platform", "modules-runtime"));
  await installProduction(join("apps", "memecoined"));
  await rename(join(stage, "apps", "memecoined", "node_modules"), join(stage, "apps", "memecoined", "modules-runtime"));
  await copy("platform/packages/app-sdk", "apps/memecoined/modules-runtime/@timsys/app-sdk");
  await installProduction(join("apps", "dressed"));
  await rename(join(stage, "apps", "dressed", "node_modules"), join(stage, "apps", "dressed", "modules-runtime"));
  await copy("platform/packages/app-sdk", "apps/dressed/modules-runtime/@timsys/app-sdk");
  await installProduction(join("apps", "researched"));
  await rename(join(stage, "apps", "researched", "node_modules"), join(stage, "apps", "researched", "modules-runtime"));
  await copy("platform/packages/app-sdk", "apps/researched/modules-runtime/@timsys/app-sdk");
  for (const item of ["bin", "lib", "share", "server_license.txt", "commandlinetools_3rd_party_licenses.txt"])
    await copy(`apps/launcher/.cache/postgres/${item}`, `runtime/postgres/${item}`);
}
