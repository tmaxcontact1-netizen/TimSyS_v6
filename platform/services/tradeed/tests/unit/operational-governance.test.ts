import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("operational governance", () => {
  it("documents every configured mode and preserves the linear promotion order", () => {
    const config = read("src/infrastructure/config/load-config.ts");
    const gates = read("docs/PROMOTION_GATES.md");
    const readme = read("README.md");
    for (const mode of [
      "historical",
      "observation",
      "shadow",
      "paper",
      "supervised_live",
      "limited_auto",
      "full_auto",
    ]) {
      expect(config).toContain(`"${mode}"`);
      expect(gates).toContain(mode);
      expect(readme).toContain(mode);
    }
    expect(gates).toContain(
      "historical → observation → shadow → paper → supervised_live → limited_auto → full_auto",
    );
  });

  it("requires human promotion and explicit stop, rollback, incident and recovery controls", () => {
    const gates = read("docs/PROMOTION_GATES.md");
    const runbook = read("docs/OPERATIONS_RUNBOOK.md");
    expect(gates).toMatch(/A named human operator/);
    expect(gates).toMatch(/full_auto.*remains prohibited/is);
    for (const contract of [
      "Stop conditions",
      "Rollback",
      "Incident severity",
      "encrypted database backup",
      "restoration rehearsal",
    ])
      expect(gates).toContain(contract);
    for (const procedure of [
      "Pre-start checks",
      "Normal shutdown",
      "Immediate safe stop",
      "Backup and recovery",
      "Upgrade and rollback",
      "Operator handoff checklist",
    ])
      expect(runbook).toContain(procedure);
  });
});
