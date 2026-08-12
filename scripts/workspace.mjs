import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npmCli = process.env.npm_execpath || resolve(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
const action = process.argv[2];
const commands = {
  install: [
    ["ci", "--prefix", "platform"], ["ci", "--prefix", "apps/launcher"],
    ["ci", "--prefix", "apps/principaled"], ["ci", "--prefix", "apps/memecoined"],
  ],
  test: [
    ["test", "--prefix", "platform", "--", "--runInBand"],
    ["run", "test:electron", "--prefix", "apps/launcher"],
    ["test", "--prefix", "apps/memecoined"],
  ],
  build: [
    ["run", "build", "--prefix", "apps/principaled"],
    ["run", "build", "--prefix", "apps/memecoined"],
    ["run", "build", "--prefix", "apps/launcher"],
  ],
};
if (action === "verify") commands.verify = [...commands.test, ...commands.build];
const selected = commands[action];
if (!selected) throw new Error(`Unknown workspace action: ${action}`);

for (const args of selected) {
  await new Promise((success, failure) => {
    const child = spawn(process.execPath, [npmCli, ...args], { cwd: root, stdio: "inherit", shell: false });
    child.once("error", failure);
    child.once("exit", (code) => code === 0 ? success() : failure(new Error(`npm ${args.join(" ")} failed with ${code}`)));
  });
}
