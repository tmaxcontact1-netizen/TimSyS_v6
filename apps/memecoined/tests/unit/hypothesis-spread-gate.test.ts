import { describe, expect, test } from "vitest";

import {
  measuredSpreadLimitBps,
  roundTripSpreadBps,
} from "../../src/application/services/profile-paper-simulation.js";

describe("release 15 measured spread gate", () => {
  test("uses the median-distribution gate capped at 150 bps", () => {
    expect(measuredSpreadLimitBps(600)).toBe(150);
    expect(measuredSpreadLimitBps(300)).toBe(75);
  });

  test("measures executable round-trip loss in basis points", () => {
    expect(roundTripSpreadBps(1_000_000n, 985_000n)).toBe(150);
    expect(roundTripSpreadBps(1_000_000n, 1_001_000n)).toBe(0);
  });
});
