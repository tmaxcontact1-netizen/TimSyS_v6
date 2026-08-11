import { describe, expect, it } from "vitest";

import {
  evaluateEmergencyExit,
  type EmergencyExitSnapshot,
} from "../../src/domain/trading/exits.js";
import {
  asNonNegativeDecimal,
  asTimestamp,
  asUuid,
  type EvidenceId,
} from "../../src/domain/shared/types.js";

const at = asTimestamp("2026-08-04T12:00:00.000Z");
const evidence = Object.freeze([
  Object.freeze({
    id: asUuid<EvidenceId>("00000000-0000-4000-8000-000000000071"),
    provider: "helius" as const,
    observedAt: at,
    sourceKey: "position:emergency-monitor",
  }),
]);
const decimal = asNonNegativeDecimal;

function snapshot(overrides: Partial<EmergencyExitSnapshot> = {}): EmergencyExitSnapshot {
  return {
    evaluatedAt: at,
    liquidityUsd: decimal(100_000),
    liquidityUsdTenMinutesAgo: decimal(100_000),
    developerRelatedSoldPercentage: decimal(0),
    originatingTierASoldPercentage: decimal(0),
    confirmingTierBSoldPercentages: [decimal(0), decimal(0)],
    dangerousSecurityChangeDetected: false,
    fullExitPriceImpactPercentages: [decimal(1), decimal(1), decimal(1)],
    unexplainedBalanceDiscrepancy: false,
    marketDataUnavailableSince: null,
    marketDataAvailabilityKnown: true,
    allChainAccessUnavailableSince: null,
    chainAccessAvailabilityKnown: true,
    evidence,
    ...overrides,
  };
}

function outcome(input: EmergencyExitSnapshot, ruleId: string): string | undefined {
  return evaluateEmergencyExit(input).results.find((result) => result.ruleId === ruleId)?.outcome;
}

describe("emergency exit monitoring", () => {
  it.each([
    ["80000", "fail"],
    ["80000.000001", "pass"],
  ] as const)("applies EMG-001 at the inclusive 20%% decline boundary %s", (value, expected) => {
    expect(outcome(snapshot({ liquidityUsd: decimal(value) }), "EMG-001")).toBe(expected);
  });

  it.each([
    ["49999.999999", "fail"],
    ["50000", "pass"],
  ] as const)("applies EMG-002 below, not at, the $50,000 floor: %s", (value, expected) => {
    expect(outcome(snapshot({ liquidityUsd: decimal(value) }), "EMG-002")).toBe(expected);
  });

  it.each([
    ["developerRelatedSoldPercentage", "10", "EMG-003"],
    ["originatingTierASoldPercentage", "50", "EMG-004"],
  ] as const)("triggers %s at its inclusive wallet-sale boundary", (field, value, ruleId) => {
    expect(outcome(snapshot({ [field]: decimal(value) }), ruleId)).toBe("fail");
  });

  it("requires both Tier B wallets to reach 30%", () => {
    expect(
      outcome(
        snapshot({ confirmingTierBSoldPercentages: [decimal(30), decimal("29.999999")] }),
        "EMG-005",
      ),
    ).toBe("pass");
    expect(
      outcome(snapshot({ confirmingTierBSoldPercentages: [decimal(30), decimal(30)] }), "EMG-005"),
    ).toBe("fail");
  });

  it("triggers newly detected security danger and balance discrepancy independently", () => {
    const decision = evaluateEmergencyExit(
      snapshot({
        dangerousSecurityChangeDetected: true,
        unexplainedBalanceDiscrepancy: true,
      }),
    );
    expect(decision.triggeredRuleIds).toEqual(["EMG-006", "EMG-008"]);
    expect(decision.ruleId).toBe("EMG-006");
  });

  it("requires current impact above 8% and three strictly worsening quotes", () => {
    expect(
      outcome(
        snapshot({
          fullExitPriceImpactPercentages: [decimal(7), decimal(8), decimal("8.000001")],
        }),
        "EMG-007",
      ),
    ).toBe("fail");
    expect(
      outcome(
        snapshot({ fullExitPriceImpactPercentages: [decimal(7), decimal("7.5"), decimal(8)] }),
        "EMG-007",
      ),
    ).toBe("pass");
    expect(
      outcome(
        snapshot({ fullExitPriceImpactPercentages: [decimal(9), decimal(9), decimal(10)] }),
        "EMG-007",
      ),
    ).toBe("pass");
  });

  it.each([
    ["2026-08-04T11:59:00.001Z", "pass"],
    ["2026-08-04T11:59:00.000Z", "fail"],
  ] as const)("applies the EMG-009 60-second outage boundary at %s", (since, expected) => {
    expect(outcome(snapshot({ marketDataUnavailableSince: asTimestamp(since) }), "EMG-009")).toBe(
      expected,
    );
  });

  it.each([
    ["2026-08-04T11:59:30.001Z", "pass"],
    ["2026-08-04T11:59:30.000Z", "fail"],
  ] as const)("applies the EMG-010 30-second outage boundary at %s", (since, expected) => {
    expect(
      outcome(snapshot({ allChainAccessUnavailableSince: asTimestamp(since) }), "EMG-010"),
    ).toBe(expected);
  });

  it("reports unknown required facts without inventing an emergency trigger", () => {
    const decision = evaluateEmergencyExit(
      snapshot({
        liquidityUsd: null,
        liquidityUsdTenMinutesAgo: null,
        developerRelatedSoldPercentage: null,
        marketDataAvailabilityKnown: false,
        chainAccessAvailabilityKnown: false,
      }),
    );
    expect(decision.triggered).toBe(false);
    expect(outcome(snapshot({ liquidityUsd: null }), "EMG-002")).toBe("unknown");
    expect(decision.results.filter((result) => result.outcome === "unknown")).toHaveLength(5);
  });

  it("rejects malformed observations and future evidence", () => {
    expect(() => evaluateEmergencyExit(snapshot({ evidence: [] }))).toThrow("requires evidence");
    expect(() =>
      evaluateEmergencyExit(snapshot({ developerRelatedSoldPercentage: decimal("100.000001") })),
    ).toThrow("between zero and 100");
    expect(() =>
      evaluateEmergencyExit(
        snapshot({ marketDataUnavailableSince: asTimestamp("2026-08-04T12:00:01Z") }),
      ),
    ).toThrow("after evaluation");
  });

  it("returns immutable decisions, rule lists, results, and evidence", () => {
    const decision = evaluateEmergencyExit(snapshot({ dangerousSecurityChangeDetected: true }));
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.triggeredRuleIds)).toBe(true);
    expect(Object.isFrozen(decision.results)).toBe(true);
    expect(Object.isFrozen(decision.results[0]?.evidence)).toBe(true);
  });
});
