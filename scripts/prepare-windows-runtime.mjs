import { access, cp, mkdir, readdir, rename, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stageArgument=process.argv.find(v=>v.startsWith("--stage-dir="));
const stage=stageArgument?resolve(stageArgument.slice(12)):join(root,"apps","launcher","runtime-stage");
const offlineDependencies=process.argv.includes("--offline-installed-dependencies");
const extraDependencyRoots=process.argv.filter(v=>v.startsWith("--dependency-root=")).map(v=>resolve(v.slice(18)));
const runtimeReport=[];let dependencyIndex;
if(stage===root||stage===resolve(root,"..")||!stage.startsWith(resolve(root,"..")+ (process.platform==="win32"?"\\":"/")))throw Error("Build stage must be a dedicated directory within this workspace");
const npmCli = process.env.npm_execpath || resolve(dirname(process.execPath), "..", "node_modules", "npm", "bin", "npm-cli.js");
const sourceOnly = process.argv.includes("--refresh-source-only");

async function copy(relative, destination = relative) {
  const target = join(stage, destination);
  if(sourceOnly && relative==="platform/services")throw Error("Backend consolidation requires a full restage, including central service dependencies.");
  if (sourceOnly) await rm(target, { recursive: true, force: true });
  await cp(join(root, relative), target, { recursive: true, filter: file => !/\/platform\/services\/tradeed(?:\/|$)/.test(file.replaceAll('\\','/')) && !file.split(/[\\/]/).some(part => ["node_modules","data",".git","modules-runtime"].includes(part)) });
}
async function installProduction(directory) {
  if(offlineDependencies){const {indexInstalled,copyProductionRuntime}=await import("../platform/scripts/build/production-runtime.cjs");if(!dependencyIndex)dependencyIndex=await indexInstalled([join(root,"platform/node_modules"),...["dressed","researched"].map(id=>join(root,"platform/services",id,"node_modules")),...extraDependencyRoots]);runtimeReport.push(await copyProductionRuntime({sourceDirectory:join(root,directory),targetDirectory:join(stage,directory,"node_modules"),index:dependencyIndex}));return;}

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

if(!sourceOnly){try{await access(stage);throw Error("Choose a new stage directory; existing bundles are preserved");}catch(error){if(error.code!=="ENOENT")throw error;}}
await mkdir(stage, { recursive: true });
for (const item of [
  "platform/package.json", "platform/package-lock.json", "platform/index.js", "platform/timsys.app.json",
  "platform/config", "platform/contracts", "platform/engine", "platform/frontend", "platform/migrations",
  "platform/modules", "platform/scripts", "platform/shared",
  "platform/packages", "platform/services", "platform/native",
]) await copy(item);
await copy("apps/tradeed/frontend");
await copy("apps/tradeed/timsys.app.json");
await copy("apps/principaled/dist");
for (const app of ['principaled', 'researched', 'dressed', 'tradeed']) {
  await copy(`apps/${app}/timsys.services.json`);
  await copy(`apps/${app}/ai-adapter.json`);
  await copy(`apps/${app}/ai-adapter.json`, `platform/modules/ai_gateway/app-adapters/${app}.json`);
}
for(const app of ["dressed","researched"]){await copy("apps/"+app+"/dist/frontend");await copy("apps/"+app+"/timsys.app.json");}
for (const app of ['principaled', 'dressed', 'researched', 'tradeed']) {
  for (const file of ['package.json', 'timsys.app.json', 'ai-adapter.json', 'ai-assistant-contract.json']) {
    const relative = `apps/${app}/${file}`;
    try { await access(join(root, relative)); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    await copy(relative);
  }
}
if (!sourceOnly) {
  await installProduction("platform");
  await rename(join(stage, "platform", "node_modules"), join(stage, "platform", "modules-runtime"));
  for(const app of ["dressed","researched"]){const dir="platform/services/"+app;await installProduction(dir);await rename(join(stage,dir,"node_modules"),join(stage,dir,"modules-runtime"));await copy("platform/packages/app-sdk",dir+"/modules-runtime/@timsys/app-sdk");await copy("platform/packages/domain-http",dir+"/modules-runtime/@timsys/domain-http");}
  for (const item of ["bin", "lib", "share", "server_license.txt", "commandlinetools_3rd_party_licenses.txt"])
    await copy(`apps/launcher/.cache/postgres/${item}`, `runtime/postgres/${item}`);
}


if(offlineDependencies){const{writeFile}=await import("node:fs/promises");await writeFile(join(stage,"dependency-build-report.json"),JSON.stringify({at:new Date().toISOString(),source:root,runtimes:runtimeReport},null,2));}

const {createInstalledBaseline}=await import('../platform/scripts/build/installed-baseline.cjs');
const {writeFile:writeBaseline}=await import('node:fs/promises');
await writeBaseline(join(stage,'platform/installed-baseline.json'),JSON.stringify(createInstalledBaseline(root),null,2));
