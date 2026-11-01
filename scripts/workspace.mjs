import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npmCli = process.env.npm_execpath || resolve(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
const action = process.argv[2];
const commands = {
  install: [
    ["ci", "--prefix", "platform"], ["ci", "--prefix", "apps/launcher"],
    ["ci", "--prefix", "apps/principaled"], ["ci", "--prefix", "platform/services/tradeed"], ["ci","--prefix","apps/tradeed"],
    ["ci", "--prefix", "platform/services/dressed"], ["ci","--prefix","apps/dressed"],
    ["ci", "--prefix", "platform/services/researched"], ["ci","--prefix","apps/researched"],
  ],
  test: [
    ["test", "--prefix", "platform", "--", "--runInBand"],
    ["run", "test:wardrobe-client", "--prefix", "platform"],
    ["run", "test:electron", "--prefix", "apps/launcher"],
    ["test", "--prefix", "platform/services/tradeed"],
    ["test", "--prefix", "platform/services/dressed"],
    ["test", "--prefix", "platform/services/researched"],
  ],
  build: [
    ["run", "build", "--prefix", "apps/principaled"],
    ["run", "build", "--prefix", "platform/services/tradeed"], ["run","build","--prefix","apps/tradeed"],
    ["run", "build", "--prefix", "platform/services/dressed"], ["run","build","--prefix","apps/dressed"],
    ["run", "build", "--prefix", "platform/services/researched"], ["run","build","--prefix","apps/researched"],
    ["run", "build", "--prefix", "apps/launcher"],
  ],
};
if (action === "verify") commands.verify = [...commands.test, ...commands.build];
const selected = commands[action];
if (!selected) throw new Error(`Unknown workspace action: ${action}`);

for (const args of selected) {
  await new Promise((success, failure) => {
    let child;
    if (existsSync(npmCli)) {
      child = spawn(process.execPath, [npmCli, ...args], { cwd: root, stdio: "inherit", shell: false });
    } else {
      if (args[0] === "ci") return failure(new Error("npm is required for workspace dependency installation"));
      const prefixIndex = args.indexOf("--prefix");
      const packageDirectory = resolve(root, args[prefixIndex + 1]);
      const scriptName = args[0] === "run" ? args[1] : args[0];
      const separatorIndex = args.indexOf("--");
      const trailing = separatorIndex < 0 ? [] : args.slice(separatorIndex + 1);
      const manifest = JSON.parse(readFileSync(resolve(packageDirectory, "package.json"), "utf8"));
      const script = manifest.scripts?.[scriptName];
      if (!script) return failure(new Error(`Missing ${scriptName} script in ${args[prefixIndex + 1]}`));
      const executablePath = [resolve(packageDirectory, "node_modules", ".bin"), dirname(process.execPath), process.env.Path || process.env.PATH || ""].join(";");
      child = spawn(`${script}${trailing.length ? ` ${trailing.join(" ")}` : ""}`, [], { cwd: packageDirectory, stdio: "inherit", shell: true, env: { ...process.env, Path: executablePath, PATH: executablePath } });
    }
    child.once("error", failure);
    child.once("exit", (code) => code === 0 ? success() : failure(new Error(`npm ${args.join(" ")} failed with ${code}`)));
  });
}

