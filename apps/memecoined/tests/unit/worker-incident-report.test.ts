import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { persistHandledWorkerIncident } from "../../src/entrypoints/worker.js";

describe("handled worker incident capture", () => {
  it("persists a structured report for a caught top-level exception", () => {
    const root = mkdtempSync(join(tmpdir(), "memecoined-incident-"));
    try {
      const at = new Date("2026-09-26T10:00:00.000Z");
      const incident = persistHandledWorkerIncident(
        new Error("entry collision"),
        { TIMSYS_CHILD_LOG_ROOT: root },
        at,
      );
      const stored = JSON.parse(
        readFileSync(join(root, "worker-incident-2026-09-26T10-00-00.000Z.json"), "utf8"),
      );
      expect(stored).toMatchObject({
        schemaVersion: 1,
        kind: "handled_top_level_exception",
        message: "entry collision",
      });
      expect(incident.message).toBe("entry collision");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
