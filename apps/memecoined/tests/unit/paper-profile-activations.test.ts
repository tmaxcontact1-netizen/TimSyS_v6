import { describe, expect, it } from "vitest";

import {
  configurePaperProfile,
  ensureAllProfilesPaperTrialPreset,
  listPaperProfileActivations,
} from "../../src/infrastructure/database/paper-profile-activations.js";

describe("paper profile activations", () => {
  it("supplies safe disabled defaults when no choices have been saved", async () => {
    const database = { query: async () => ({ rows: [] }) };
    const profiles = await listPaperProfileActivations(database as never, "wallet" as never);
    expect(profiles).toHaveLength(6);
    expect(profiles.every((profile) => !profile.enabled && profile.version === 0)).toBe(true);
  });

  it("persists an activation with version and audit metadata", async () => {
    const statements: string[] = [];
    const database = {
      query: async (sql: string) => {
        statements.push(sql);
        if (sql.includes("FROM paper_profile_activations WHERE")) return { rows: [] };
        return {
          rows: [{
            profile_id: "whale_tracker", enabled: true, mode: "automatic_paper",
            allocation_bps: 1500, version: 1, updated_at: "2026-09-12T12:00:00Z",
          }],
        };
      },
    };
    const saved = await configurePaperProfile(
      database as never, "wallet" as never, "whale_tracker", 0, true,
      "automatic_paper", 1500, new Date("2026-09-12T12:00:00Z"),
    );
    expect(saved).toMatchObject({ profileId: "whale_tracker", enabled: true, version: 1 });
    expect(statements[1]).toContain("paper_profile_activation_audit");
  });

  it("installs the balanced automatic-paper trial preset without live authority", async () => {
    let values: readonly unknown[] = [];
    const database = {
      query: async (sql: string, parameters: readonly unknown[]) => {
        values = parameters;
        expect(sql).toContain("'automatic_paper'");
        expect(sql).toContain("'whale_tracker',1500");
        expect(sql).toContain("'trend_detector',2000");
        expect(sql).toContain("WHERE NOT EXISTS");
        expect(sql).toContain("paper_profile_activation_audit");
        return { rows: [{ inserted_count: "6" }] };
      },
    };
    await expect(
      ensureAllProfilesPaperTrialPreset(
        database as never,
        "wallet" as never,
        new Date("2026-09-12T12:00:00Z"),
      ),
    ).resolves.toBe(true);
    expect(values).toHaveLength(8);
  });
});
