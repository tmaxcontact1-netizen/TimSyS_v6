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
    expect(profiles.map((profile) => profile.profileId)).toEqual([
      "fast_furious",
      "oscillation_trader",
    ]);
    expect(profiles.every((profile) => !profile.enabled && profile.version === 0)).toBe(true);
  });

  it("persists an activation with version and audit metadata", async () => {
    const statements: string[] = [];
    const database = {
      query: async (sql: string) => {
        statements.push(sql);
        if (sql.trimStart().startsWith("SELECT profile_id")) return { rows: [] };
        return {
          rows: [{
            profile_id: "fast_furious", enabled: true, mode: "automatic_paper",
            allocation_bps: 1500, version: 1, updated_at: "2026-09-12T12:00:00Z",
          }],
        };
      },
    };
    const saved = await configurePaperProfile(
      database as never, "wallet" as never, "fast_furious", 0, true,
      "automatic_paper", 1500, new Date("2026-09-12T12:00:00Z"),
    );
    expect(saved).toMatchObject({ profileId: "fast_furious", enabled: true, version: 1 });
    expect(statements[1]).toContain("paper_profile_activation_audit");
  });

  it("installs the balanced automatic-paper trial preset without live authority", async () => {
    let values: readonly unknown[] = [];
    const database = {
      query: async (sql: string, parameters: readonly unknown[]) => {
        values = parameters;
        expect(sql).toContain("'automatic_paper'");
        expect(sql).not.toContain("'whale_tracker'");
        expect(sql).toContain("'fast_furious',true,'automatic_paper',5000");
        expect(sql).toContain("'oscillation_trader',true,'automatic_paper',5000");
        expect(sql).not.toContain("'trend_detector'");
        expect(sql).toContain("WHERE NOT EXISTS");
        expect(sql).toContain("paper_profile_activation_audit");
        return { rows: [{ inserted_count: "2" }] };
      },
    };
    await expect(
      ensureAllProfilesPaperTrialPreset(
        database as never,
        "wallet" as never,
        new Date("2026-09-12T12:00:00Z"),
      ),
    ).resolves.toBe(true);
    expect(values).toHaveLength(4);
  });

  it("blocks reactivating a retired profile", async () => {
    const database = { query: async () => ({ rows: [] }) };
    await expect(configurePaperProfile(
      database as never, "wallet" as never, "social_catalyst", 0, true,
      "automatic_paper", 500, new Date("2026-09-12T12:00:00Z"),
    )).rejects.toThrow(/no longer available/i);
  });
});
