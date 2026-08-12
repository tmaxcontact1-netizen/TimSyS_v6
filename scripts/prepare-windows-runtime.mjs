import { cp, mkdir, rename, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stage = join(root, "apps", "launcher", "runtime-stage");
const npmCli = process.env.npm_execpath || resolve(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");

async function copy(relative, destination = relative) {
  await cp(join(root, relative), join(stage, destination), { recursive: true });
}
async function installProduction(directory) {
  await new Promise((success, failure) => {
    const child = spawn(process.execPath, [npmCli, "ci", "--omit=dev", "--ignore-scripts"], {
      cwd: join(stage, directory), stdio: "inherit", shell: false,
    });
    child.once("error", failure);
    child.once("exit", (code) => code === 0 ? success() : failure(new Error(`Production install failed in ${directory}`)));
  });
}

await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
for (const item of [
  "platform/package.json", "platform/package-lock.json", "platform/index.js", "platform/timsys.app.json",
  "platform/config", "platform/contracts", "platform/engine", "platform/frontend", "platform/migrations",
  "platform/modules", "platform/scripts", "platform/shared",
]) await copy(item);
for (const item of [
  "apps/memecoined/package.json", "apps/memecoined/package-lock.json", "apps/memecoined/dist",
  "apps/memecoined/frontend", "apps/memecoined/migrations", "apps/memecoined/.env.example",
  "apps/memecoined/timsys.app.json",
]) await copy(item);
await copy("apps/principaled/dist");
await installProduction("platform");
await rename(join(stage, "platform", "node_modules"), join(stage, "platform", "modules-runtime"));
await installProduction(join("apps", "memecoined"));
await rename(join(stage, "apps", "memecoined", "node_modules"), join(stage, "apps", "memecoined", "modules-runtime"));
for (const item of ["bin", "lib", "share", "server_license.txt", "commandlinetools_3rd_party_licenses.txt"])
  await copy(`apps/launcher/.cache/postgres/${item}`, `runtime/postgres/${item}`);
