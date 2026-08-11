import { describe, expect, it } from "vitest";
import {
  evaluateCircuitBreakers,
  type CircuitBreakerSnapshot,
} from "../../src/domain/portfolio/breakers.js";
import {
  asNonNegativeDecimal,
  asSolanaSlot,
  asTimestamp,
  asUuid,
  type EvidenceId,
} from "../../src/domain/shared/types.js";

const observedAt = asTimestamp("2026-08-04T20:00:00Z");
function valid(overrides: Partial<CircuitBreakerSnapshot> = {}): CircuitBreakerSnapshot {
  return Object.freeze({
    observedAt,
    evidence: Object.freeze([
      {
        id: asUuid<EvidenceId>("00000000-0000-4000-8000-000000000701"),
        provider: "solana_rpc" as const,
        observedAt,
        sourceKey: "portfolio:risk",
        slot: asSolanaSlot(7n),
      },
    ]),
    utcDayStartingEquitySol: asNonNegativeDecimal(100),
    dailyRealizedLossSol: asNonNegativeDecimal(0),
    executableUnrealizedLossSol: asNonNegativeDecimal(0),
    rollingSevenDayDrawdownPercentage: asNonNegativeDecimal(0),
    highWaterDrawdownPercentage: asNonNegativeDecimal(0),
    consecutiveClosedLosingTrades: 0n,
    reconciliationFailuresLast24Hours: 0n,
    unauthorizedTransactionDetected: false,
    authoritativeDisagreementDurationMs: 0n,
    ...overrides,
  });
}

describe("portfolio circuit breakers", () => {
  it("permits entry when all eight breakers are clear", () => {
    const decision = evaluateCircuitBreakers(valid());
    expect(decision).toMatchObject({ entryAllowed: true, lockKind: "none", triggeredRuleIds: [] });
    expect(decision.results).toHaveLength(8);
  });
  it.each([
    [{ dailyRealizedLossSol: asNonNegativeDecimal(2) }, "CBR-001"],
    [{ executableUnrealizedLossSol: asNonNegativeDecimal(3) }, "CBR-002"],
    [{ rollingSevenDayDrawdownPercentage: asNonNegativeDecimal(6) }, "CBR-003"],
    [{ highWaterDrawdownPercentage: asNonNegativeDecimal(8) }, "CBR-004"],
    [{ consecutiveClosedLosingTrades: 3n }, "CBR-005"],
    [{ reconciliationFailuresLast24Hours: 2n }, "CBR-006"],
    [{ unauthorizedTransactionDetected: true }, "CBR-007"],
    [{ authoritativeDisagreementDurationMs: 60_001n }, "CBR-008"],
  ] as const)("triggers the exact threshold for %s", (override, ruleId) => {
    expect(evaluateCircuitBreakers(valid(override)).triggeredRuleIds).toContain(ruleId);
  });
  it("fails closed on unknown authority and protects non-resumable locks", () => {
    const decision = evaluateCircuitBreakers(valid({ unauthorizedTransactionDetected: null }));
    expect(decision).toMatchObject({ entryAllowed: false, lockKind: "protected" });
    expect(decision.triggeredRuleIds).toContain("CBR-007");
  });
});
