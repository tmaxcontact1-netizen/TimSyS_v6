const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const {
  LocalPostgresManager,
} = require("../apps/launcher/electron/local-postgres-manager.cjs");
const {
  SupervisedAppManager,
} = require("../apps/launcher/electron/supervised-app-manager.cjs");

const root = path.resolve(__dirname, "..");
const appRoot = path.join(root, "apps", "memecoined");
const postgresRoot = path.join(
  root,
  "apps",
  "launcher",
  "runtime-stage",
  "runtime",
  "postgres",
);
const installedDataRoot = path.join(
  process.env.APPDATA || "",
  "timsys-launcher",
  "memecoined",
);
const configRoot = path.join(installedDataRoot, "config");
const configFile = path.join(configRoot, ".env");
const durationSeconds = Number(process.argv[2] || "90");

if (
  !Number.isSafeInteger(durationSeconds) ||
  durationSeconds < 30 ||
  durationSeconds > 3600
) {
  throw new Error("Trial duration must be an integer from 30 to 3600 seconds");
}

function parseEnvironment(content) {
  const result = {};
  for (const sourceLine of content.split(/\r?\n/)) {
    const line = sourceLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    )
      value = value.slice(1, -1);
    if (value) result[key] = value;
  }
  return result;
}

function runNode(script, args, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: appRoot,
      env: environment,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (value) => {
      stdout += String(value);
    });
    child.stderr.on("data", (value) => {
      stderr += String(value);
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve(stdout.trim())
        : reject(
            new Error(stderr.trim() || `Child process exited with ${code}`),
          ),
    );
  });
}

async function wait(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main() {
  const configured = parseEnvironment(await fs.readFile(configFile, "utf8"));
  if (configured.MEMECOINED_MODE !== "paper")
    throw new Error("Controlled trial requires paper mode");
  const liveAuthority = [
    "TRADING_WALLET_SECRET_FILE",
    "TRANSACTION_ALLOWED_PROGRAM_IDS",
    "TRANSACTION_ALLOWED_FEE_RECIPIENTS",
    "TRANSACTION_ALLOWED_DESTINATIONS",
    "TRANSACTION_MAX_PRIORITY_FEE_LAMPORTS",
  ].filter((name) => configured[name]);
  if (liveAuthority.length > 0)
    throw new Error("Controlled trial refuses live transaction authority");

  const trialDataRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "timsys-memecoined-trial-"),
  );
  const postgres = new LocalPostgresManager({
    binaryRoot: postgresRoot,
    dataRoot: trialDataRoot,
  });
  const supervisor = new SupervisedAppManager({
    runtimeExecutable: process.execPath,
  });
  const logCounts = {
    worker: { info: 0, error: 0 },
    dashboard: { info: 0, error: 0 },
  };
  supervisor.on("log", ({ process, level }) => {
    if (logCounts[process] && Object.hasOwn(logCounts[process], level))
      logCounts[process][level] += 1;
  });
  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    await supervisor.stopAll().catch(() => undefined);
    if (postgres.state) await postgres.backup().catch(() => undefined);
    await postgres.stop().catch(() => undefined);
    const resolvedTrialRoot = path.resolve(trialDataRoot);
    const resolvedTempRoot = path.resolve(os.tmpdir());
    if (resolvedTrialRoot.startsWith(`${resolvedTempRoot}${path.sep}`))
      await fs
        .rm(resolvedTrialRoot, { recursive: true, force: true })
        .catch(() => undefined);
  };
  process.once("SIGINT", () => void stop());
  process.once("SIGTERM", () => void stop());

  try {
    const database = await postgres.start();
    const environment = {
      ...process.env,
      ...configured,
      MEMECOINED_ENV: "production",
      MEMECOINED_MODE: "paper",
      MEMECOINED_APP_ROOT: appRoot,
      MEMECOINED_CONFIG_DIR: configRoot,
      MEMECOINED_INSTANCE_ID: "controlled-paper-trial",
      MEMECOINED_MANAGED_DATABASE: "1",
      DATABASE_URL: database.runtimeUrl,
      DATABASE_MIGRATION_URL: database.migrationUrl,
      PAPER_DASHBOARD_PORT: "18080",
      NODE_PATH: path.join(appRoot, "node_modules"),
    };
    await runNode(
      path.join(appRoot, "dist", "scripts", "migrate.js"),
      [],
      environment,
    );
    await postgres.grantRuntimePrivileges();
    const verification = JSON.parse(
      await runNode(
        path.join(appRoot, "dist", "scripts", "verify-environment.js"),
        ["--probe-providers"],
        environment,
      ),
    );
    const startedAt = new Date();
    await supervisor.start(path.join(appRoot, "timsys.app.json"), environment);
    const samples = [];
    const deadline = Date.now() + durationSeconds * 1000;
    while (Date.now() < deadline) {
      await wait(Math.min(10_000, deadline - Date.now()));
      const health = await fetch("http://127.0.0.1:18080/api/health");
      const pipeline = await fetch("http://127.0.0.1:18080/api/paper/pipeline");
      samples.push({
        observedAt: new Date().toISOString(),
        healthStatus: health.status,
        pipelineStatus: pipeline.status,
        pipeline: pipeline.ok ? (await pipeline.json()).pipeline : null,
      });
    }
    const status = supervisor.status("memecoined");
    const report = {
      event: "controlled_paper_trial_completed",
      mode: "paper",
      transactionAuthority: false,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      durationSeconds,
      environmentVerification: verification,
      supervisor: {
        state: status.state,
        processes: status.processes,
        detail: status.detail,
      },
      logCounts,
      samples,
    };
    process.stdout.write(`${JSON.stringify(report)}\n`);
  } finally {
    await stop();
  }
}

main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({ event: "controlled_paper_trial_failed", message: error instanceof Error ? error.message : "Unknown failure" })}\n`,
  );
  process.exitCode = 1;
});
