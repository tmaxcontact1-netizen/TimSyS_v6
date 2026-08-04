import { describe, expect, it } from "vitest";

import { createMarketSnapshot, usd, type MarketSnapshot } from "../../src/domain/market/model.js";
import { evaluateMarket } from "../../src/domain/market/momentum.js";
import {
  asPercentage,
  asSolanaSlot,
  asTimestamp,
  asUuid,
  type EvidenceId,
} from "../../src/domain/shared/types.js";

const observedAt = asTimestamp("2026-08-04T00:00:00.000Z");
const evidence = [
  {
    id: asUuid<EvidenceId>("00000000-0000-4000-8000-000000000011"),
    provider: "dexscreener" as const,
    observedAt,
    sourceKey: "pair:market",
    slot: asSolanaSlot(2n),
  },
];

function valid(overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  return createMarketSnapshot({
    observedAt,
    evidence,
    chain: "solana",
    quoteAsset: "SOL",
    poolAgeMinutes: usd(30),
    marketCapitalizationUsd: usd(250_000),
    liquidityUsd: usd(100_000),
    liquidityUsdFifteenMinutesAgo: usd(100_500),
    fiveMinutePriceChange: asPercentage(3),
    oneHourPriceChange: asPercentage(8),
    fiveMinuteVolumeUsd: usd(20_000),
    precedingOneHourVolumeUsd: usd(100_000),
    fiveMinuteBuyTransactions: 26n,
    fiveMinuteSellTransactions: 20n,
    fiveMinuteUniqueBuyers: 25n,
    largestBuyerVolumePercentage: asPercentage(20),
    currentExecutablePriceUsd: usd(88),
    fiveMinuteExecutableHighUsd: usd(100),
    confirmingWalletVolumeWeightedEntryUsd: usd(74),
    ...overrides,
  });
}

function outcome(snapshot: MarketSnapshot, id: string): string | undefined {
  return evaluateMarket(snapshot).results.find(({ ruleId }) => ruleId === id)?.outcome;
}

describe("deterministic market gates", () => {
  it("passes all 19 rules at inclusive boundaries", () => {
    const decision = evaluateMarket(valid());
    expect(decision.results).toHaveLength(19);
    expect(decision.eligible).toBe(true);
  });

  it.each([
    ["UNI-002", "SEC-006", "29.999999", "fail"],
    ["UNI-002", "SEC-006", "30", "pass"],
    ["UNI-002", "SEC-006", "43200", "pass"],
    ["UNI-002", "SEC-006", "43200.000001", "fail"],
    ["UNI-003", "SEC-007", "249999.999999", "fail"],
    ["UNI-003", "SEC-007", "250000", "pass"],
    ["UNI-003", "SEC-007", "20000000", "pass"],
    ["UNI-003", "SEC-007", "20000000.000001", "fail"],
    ["UNI-004", "SEC-005", "74999.999999", "fail"],
    ["UNI-004", "SEC-005", "75000", "pass"],
  ])("applies %s/%s boundary %s", (universeId, securityId, value, expected) => {
    const field =
      universeId === "UNI-002"
        ? { poolAgeMinutes: usd(value) }
        : universeId === "UNI-003"
          ? { marketCapitalizationUsd: usd(value) }
          : { liquidityUsd: usd(value) };
    expect(outcome(valid(field), universeId)).toBe(expected);
    expect(outcome(valid(field), securityId)).toBe(expected);
  });

  it.each([
    ["14.999999", "pass"],
    ["15", "fail"],
    ["15.000001", "fail"],
  ])("applies SEC-011 at %s%% decline", (decline, expected) => {
    const liquidity = usd(100_000).mul(usd(100).minus(decline)).div(100);
    expect(
      outcome(
        valid({
          liquidityUsdFifteenMinutesAgo: usd(100_000),
          liquidityUsd: usd(liquidity),
        }),
        "SEC-011",
      ),
    ).toBe(expected);
  });

  it("fails closed for missing required facts", () => {
    const decision = evaluateMarket(
      valid({
        poolAgeMinutes: null,
        liquidityUsd: null,
        fiveMinuteVolumeUsd: null,
        fiveMinuteBuyTransactions: null,
      }),
    );
    expect(decision.failedRuleIds).toEqual(
      expect.arrayContaining([
        "UNI-002",
        "UNI-004",
        "SEC-005",
        "SEC-006",
        "SEC-011",
        "SEC-012",
        "MOM-003",
        "MOM-004",
        "MOM-005",
      ]),
    );
  });

  it.each([
    ["2.999999", "fail"],
    ["3", "pass"],
    ["18", "pass"],
    ["18.000001", "fail"],
  ])("applies MOM-001 at %s", (value, expected) => {
    expect(outcome(valid({ fiveMinutePriceChange: asPercentage(value) }), "MOM-001")).toBe(
      expected,
    );
  });

  it.each([
    ["7.999999", "fail"],
    ["8", "pass"],
    ["60", "pass"],
    ["60.000001", "fail"],
  ])("applies MOM-002 at %s", (value, expected) => {
    expect(outcome(valid({ oneHourPriceChange: asPercentage(value) }), "MOM-002")).toBe(expected);
  });

  it.each([
    ["19999.999999", "fail"],
    ["20000", "pass"],
  ])("applies MOM-003 and MOM-004 at %s", (value, expected) => {
    const snapshot = valid({ fiveMinuteVolumeUsd: usd(value) });
    expect(outcome(snapshot, "MOM-003")).toBe(expected);
    expect(outcome(snapshot, "MOM-004")).toBe(expected);
  });

  it("handles ratio and zero-sell rules exactly", () => {
    expect(
      outcome(
        valid({ fiveMinuteBuyTransactions: 129n, fiveMinuteSellTransactions: 100n }),
        "MOM-005",
      ),
    ).toBe("fail");
    expect(
      outcome(
        valid({ fiveMinuteBuyTransactions: 130n, fiveMinuteSellTransactions: 100n }),
        "MOM-005",
      ),
    ).toBe("pass");
    expect(
      outcome(valid({ fiveMinuteSellTransactions: 0n, fiveMinuteUniqueBuyers: 25n }), "MOM-005"),
    ).toBe("pass");
    expect(
      outcome(valid({ fiveMinuteSellTransactions: 0n, fiveMinuteUniqueBuyers: 24n }), "MOM-005"),
    ).toBe("fail");
    expect(
      outcome(valid({ fiveMinuteSellTransactions: 0n, liquidityUsd: usd(74_999) }), "MOM-005"),
    ).toBe("fail");
  });

  it.each([
    [24n, "fail"],
    [25n, "pass"],
  ])("applies MOM-006 at %s buyers", (value, expected) => {
    expect(outcome(valid({ fiveMinuteUniqueBuyers: value }), "MOM-006")).toBe(expected);
  });

  it.each([
    ["20", "pass"],
    ["20.000001", "fail"],
  ])("applies MOM-007 at %s", (value, expected) => {
    expect(outcome(valid({ largestBuyerVolumePercentage: asPercentage(value) }), "MOM-007")).toBe(
      expected,
    );
  });

  it.each([
    ["88", "pass"],
    ["87.999999", "fail"],
  ])("applies MOM-008 at price %s", (value, expected) => {
    expect(outcome(valid({ currentExecutablePriceUsd: usd(value) }), "MOM-008")).toBe(expected);
  });

  it.each([
    ["120", "pass"],
    ["120.000001", "fail"],
  ])("applies MOM-009 at price %s", (value, expected) => {
    expect(
      outcome(
        valid({
          currentExecutablePriceUsd: usd(value),
          fiveMinuteExecutableHighUsd: usd(200),
          confirmingWalletVolumeWeightedEntryUsd: usd(100),
        }),
        "MOM-009",
      ),
    ).toBe(expected);
  });

  it.each([
    ["99500", "pass"],
    ["99000.000001", "pass"],
    ["99000", "fail"],
  ])("applies MOM-010 at liquidity %s", (value, expected) => {
    expect(
      outcome(
        valid({
          liquidityUsdFifteenMinutesAgo: usd(100_000),
          liquidityUsd: usd(value),
        }),
        "MOM-010",
      ),
    ).toBe(expected);
  });

  it("rejects invalid snapshots and freezes decisions", () => {
    expect(() => valid({ evidence: [] })).toThrow("requires source evidence");
    expect(() => valid({ fiveMinuteBuyTransactions: -1n })).toThrow("must be non-negative");
    const decision = evaluateMarket(valid());
    expect(Object.isFrozen(decision.results)).toBe(true);
    expect(Object.isFrozen(decision.failedRuleIds)).toBe(true);
  });
});
