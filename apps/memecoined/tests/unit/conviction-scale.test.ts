import { describe, expect, it } from "vitest";

import {
  convictionPositionAmount,
  convictionScore,
  convictionSizeMultiplierBps,
  tokenLossControl,
  tokenSessionLossCapBps,
} from "../../src/domain/strategy/conviction-scale.js";
import { persistConvictionScore } from "../../src/infrastructure/database/conviction-score.js";

describe("Conviction Scale", () => {
  it("persists an auditable 100-point breakdown from the four declared components", () => {
    const result = convictionScore({
      entryDistanceBps: 100,
      spreadBps: 0,
      buyPressure: 1,
      sessionTokenNetBps: 1_000,
    });
    expect(result).toMatchObject({
      total: 100,
      entryDepth: 35,
      spread: 25,
      buyPressure: 20,
      sessionTrackRecord: 20,
    });
    expect(result.input.entryDistanceBps).toBe(100);
  });

  it("maps score to 0.5x–1.5x while never exceeding the absolute position cap", () => {
    expect(convictionSizeMultiplierBps(0)).toBe(5_000);
    expect(convictionSizeMultiplierBps(100)).toBe(15_000);
    expect(
      convictionPositionAmount({
        availableRaw: 10_000n,
        baseRiskSizedRaw: 8_000n,
        absoluteCapRaw: 9_000n,
        score: 100,
      }),
    ).toBe(9_000n);
  });

  it("replays the epoch-16 NVpUDQ sequence without blocking profitable controls", () => {
    const now = Date.parse("2026-09-29T02:51:00Z");
    expect(
      tokenLossControl({
        hardStopTimes: [Date.parse("2026-09-29T01:02:00Z"), Date.parse("2026-09-29T01:18:00Z")],
        sessionNetBps: -713,
        now,
      }),
    ).toMatchObject({ blocked: true });
    expect(tokenLossControl({ hardStopTimes: [], sessionNetBps: 1_610, now }).blocked).toBe(false);
    expect(tokenLossControl({ hardStopTimes: [], sessionNetBps: 987, now }).blocked).toBe(false);
    expect(
      tokenLossControl({ hardStopTimes: [], sessionNetBps: -tokenSessionLossCapBps, now }).blocked,
    ).toBe(true);
  });

  it("round-trips every score component through the persistence contract", async () => {
    const score = convictionScore({
      entryDistanceBps: 75,
      spreadBps: 30,
      buyPressure: 0.62,
      sessionTokenNetBps: 240,
    });
    let stored: readonly unknown[] = [];
    await persistConvictionScore(
      {
        query: async (_sql: string, values?: readonly unknown[]) => {
          stored = values ?? [];
          return { rows: [], rowCount: 1 } as never;
        },
      } as never,
      {
        id: "row-id",
        signalId: "signal-id",
        wallet: "wallet",
        tokenMint: "mint",
        observedAt: "2026-09-29T00:00:00.000Z",
        qualified: true,
        score,
      },
    );
    expect(stored.slice(6, 11)).toEqual([
      score.total,
      score.entryDepth,
      score.spread,
      score.buyPressure,
      score.sessionTrackRecord,
    ]);
    expect(stored.slice(11)).toEqual([75, 30, 0.62, 240]);
  });
});
