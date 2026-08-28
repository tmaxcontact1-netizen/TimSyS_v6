import { describe, expect, it } from "vitest";

import { PostgresLiveEntryPlanningSource } from "../../src/infrastructure/database/live-entry-planning.js";

const row = {
  signal_id: "11111111-1111-4111-8111-111111111111",
  mint_address: "11111111111111111111111111111111",
  position_size_sol: "0.002",
  risk_run_id: "risk-1",
  candidate_evaluated_at: "2026-08-27T10:00:00.000Z",
};

describe("live entry planning trial ceiling", () => {
  it("refuses risk-qualified work above the separately authorized live ceiling", async () => {
    const source = new PostgresLiveEntryPlanningSource(
      { query: async () => ({ rows: [row] }) } as never,
      "11111111111111111111111111111111" as never,
      1_000_000n,
    );
    await expect(source.nextBatch()).rejects.toThrow(/trial ceiling/);
  });

  it("allows work at the exact authorized ceiling", async () => {
    const source = new PostgresLiveEntryPlanningSource(
      { query: async () => ({ rows: [{ ...row, position_size_sol: "0.001" }] }) } as never,
      "11111111111111111111111111111111" as never,
      1_000_000n,
    );
    await expect(source.nextBatch()).resolves.toMatchObject([{ inputAmountLamports: 1_000_000n }]);
  });
});
