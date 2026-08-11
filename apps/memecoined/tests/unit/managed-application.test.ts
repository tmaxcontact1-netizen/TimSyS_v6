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
  id: "memecoined",
  name: "Memecoined",
  kind: "supervised-child",
  applicationRootEnvironment: "MEMECOINED_APP_ROOT",
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
  ownership: { runtime: "memecoined", database: "memecoined", configuration: "memecoined" },
};

async function root(): Promise<string> {
  return mkdtemp(join(tmpdir(), "memecoined-managed-"));
}

describe("managed application contract", () => {
  it("loads the fixed TimSyS supervision contract", async () => {
    const directory = await root();
    await writeFile(join(directory, "timsys.app.json"), JSON.stringify(manifest));
    await expect(loadManagedApplicationManifest({ MEMECOINED_APP_ROOT: directory })).resolves.toEqual(
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
      loadManagedApplicationManifest({ MEMECOINED_APP_ROOT: directory }),
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
      verifyInstallAssets({ MEMECOINED_APP_ROOT: directory }, manifest),
    ).rejects.toThrow(/dashboard\.js/);
  });
});
