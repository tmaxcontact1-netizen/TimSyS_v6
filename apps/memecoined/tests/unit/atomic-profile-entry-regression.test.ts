import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/application/services/profile-paper-simulation.ts"),
  "utf8",
);

describe("atomic profile-entry regression", () => {
  it("has exactly one pending-entry invocation owner", () => {
    const invocations = source.match(/await processPendingEntries\(\{/g) ?? [];
    expect(invocations).toHaveLength(1);
    expect(source).toContain("Pending entries have one owner");
  });

  it("demotes an already-existing position to an idempotent skip", () => {
    expect(source).not.toContain('throw new Error("Profile position changed during entry")');
    expect(source).toContain("if (existing.rowCount) return false");
    expect(source).toContain("if (inserted.rowCount !== 1) {");
  });

  it("commits fill, intent and outcome inside the same transaction", () => {
    const start = source.indexOf("const entered = await transaction");
    const end = source.indexOf("return entered", start);
    const commit = source.slice(start, end);
    expect(commit).toContain("INSERT INTO paper_profile_positions");
    expect(commit).toContain("INSERT INTO paper_profile_fills");
    expect(commit).toContain("UPDATE paper_profile_entry_intents SET state='entered'");
    expect(commit).toContain("UPDATE paper_profile_signal_outcomes SET lifecycle_state='entered'");
  });

  it("serializes both overlap orderings on the profile account", () => {
    const start = source.indexOf("const entered = await transaction");
    const end = source.indexOf("return entered", start);
    const commit = source.slice(start, end);
    expect(commit).toContain("FOR UPDATE");
    expect(commit.indexOf("FOR UPDATE")).toBeLessThan(
      commit.indexOf("INSERT INTO paper_profile_positions"),
    );
  });
});
