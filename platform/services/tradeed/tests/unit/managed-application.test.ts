import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  loadManagedApplicationManifest,
  verifyInstallAssets,
  type ManagedApplicationManifest,
} from "../../src/infrastructure/runtime/managed-application.js";

const manifest: ManagedApplicationManifest = {
  schemaVersion: 1,
  id: "tradeed",
  name: "Tradeed",
  kind: "supervised-child",
  applicationRootEnvironment: "TRADEED_APP_ROOT",
  workingDirectory: ".",
  processes: {
    worker: { command: "node", arguments: ["dist/src/entrypoints/worker.js"] },
    dashboard: {
      command: "node",
      arguments: ["dist/src/entrypoints/dashboard.js"],
      health: {
        url: "http://127.0.0.1:${PAPER_DASHBOARD_PORT}/api/health",
        expectedStatus: 200,
      },
    },
  },
  shutdown: { signal: "SIGTERM", timeoutMilliseconds: 10_000 },
  ownership: { runtime: "tradeed", database: "tradeed", configuration: "tradeed" },
};

async function root(): Promise<string> {
  return mkdtemp(join(tmpdir(), "tradeed-managed-"));
}

describe("managed application contract", () => {
  it("loads the fixed TimSyS supervision contract", async () => {
    const directory = await root();
    await writeFile(join(directory, "timsys.app.json"), JSON.stringify(manifest));
    await expect(loadManagedApplicationManifest({ TRADEED_APP_ROOT: directory })).resolves.toEqual(
      manifest,
    );
  });

  it("rejects arbitrary commands and health endpoints", async () => {
    const directory = await root();
    await writeFile(
      join(directory, "timsys.app.json"),
      JSON.stringify({
        ...manifest,
        processes: {
          ...manifest.processes,
          worker: { command: "bash", arguments: ["dist/worker.js"] },
        },
      }),
    );
    await expect(
      loadManagedApplicationManifest({ TRADEED_APP_ROOT: directory }),
    ).rejects.toThrow(/Invalid managed-application manifest/);
  });

  it("fails closed when a packaged runtime asset is absent", async () => {
    const directory = await root();
    await mkdir(join(directory, "dist/src/entrypoints"), { recursive: true });
    await mkdir(join(directory, "frontend"));
    await mkdir(join(directory, "migrations"));
    await writeFile(join(directory, "dist/src/entrypoints/worker.js"), "");
    await writeFile(join(directory, "frontend/index.html"), "");
    await expect(
      verifyInstallAssets({ TRADEED_APP_ROOT: directory }, manifest),
    ).rejects.toThrow(/dashboard\.js/);
  });
});
