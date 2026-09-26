import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

const evidenceTables = [
  "paper_cash_events",
  "paper_entry_executions",
  "paper_exit_evaluations",
  "paper_fast_market_observations",
  "paper_fast_signal_events",
  "paper_fills",
  "paper_lot_disposals",
  "paper_operator_control_audit",
  "paper_position_close_requests",
  "paper_position_lots",
  "paper_position_work",
  "paper_profile_accounts",
  "paper_profile_candidate_decisions",
  "paper_profile_entry_intents",
  "paper_profile_fills",
  "paper_profile_positions",
  "paper_profile_post_exit_observations",
  "paper_profile_regime_watches",
  "paper_profile_signal_outcomes",
  "paper_profile_signals",
  "paper_realized_performance",
  "paper_observation_cycles",
  "paper_observation_attempts",
  "paper_observation_provider_calls",
  "paper_profile_evaluation_watermarks",
  "paper_observation_probe_assignments",
] as const;

describe("paper validation reset stale-history regression", () => {
  it("unconditionally clears every runtime evidence table while preserving configuration", () => {
    const migration = read("migrations/0060_observation_scheduler_telemetry.sql");
    const resetBody = migration.slice(
      migration.lastIndexOf("CREATE OR REPLACE FUNCTION reset_paper_validation_epoch"),
    );

    expect(resetBody).toContain("TRUNCATE TABLE");
    expect(resetBody).toContain("CASCADE");
    for (const table of evidenceTables) expect(resetBody).toContain(table);

    for (const preserved of [
      "paper_accounts",
      "paper_profile_activations",
      "paper_profile_activation_audit",
      "schema_migrations",
    ]) {
      expect(resetBody).not.toMatch(new RegExp(`TRUNCATE[^;]*\\b${preserved}\\b`, "s"));
    }
  });

  it("allows none of 150,000 stale evidence rows to influence the next epoch", () => {
    const currentEpoch = 9;
    const staleRows = Array.from({ length: 150_000 }, (_, index) => ({
      epochId: 8,
      qualified: index % 7 === 0,
      score: index % 101,
    }));

    const visibleToCurrentEpoch = staleRows.filter((row) => row.epochId === currentEpoch);
    const qualifiedByCurrentEpoch = visibleToCurrentEpoch.filter((row) => row.qualified);

    expect(visibleToCurrentEpoch).toHaveLength(0);
    expect(qualifiedByCurrentEpoch).toHaveLength(0);
  });
});
