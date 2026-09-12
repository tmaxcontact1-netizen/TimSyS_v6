import { spawn } from "node:child_process";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const launcher = join(root, "apps", "launcher");
const builderArguments = process.argv.slice(2);
const environment = {
  ...process.env,
  PATH: [
    join(root, "build-tools"),
    dirname(process.execPath),
    process.env.PATH ?? "",
  ].join(delimiter),
  TIMSYS_NODE_EXECUTABLE: process.execPath,
};

async function run(script, args = []) {
  await new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [join(launcher, script), ...args], {
      cwd: launcher,
      env: environment,
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolveRun()
        : reject(new Error(`${script} failed with exit code ${code}`)),
    );
  });
}

await run(join("node_modules", "vite", "bin", "vite.js"), ["build"]);
await run(join("node_modules", "electron-builder", "out", "cli", "cli.js"), builderArguments);
