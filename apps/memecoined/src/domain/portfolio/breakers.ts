import { Decimal } from "decimal.js";

import { createRuleResult, type EvidenceReference, type RuleResult } from "../shared/evidence.js";
import { asDecimal, asRuleId, type DecimalValue, type Timestamp } from "../shared/types.js";

export type EntryLockKind = "none" | "operator_resumable" | "protected";

export interface CircuitBreakerSnapshot {
  readonly observedAt: Timestamp;
  readonly evidence: readonly EvidenceReference[];
  readonly utcDayStartingEquitySol: DecimalValue | null;
  readonly dailyRealizedLossSol: DecimalValue | null;
  readonly executableUnrealizedLossSol: DecimalValue | null;
  readonly rollingSevenDayDrawdownPercentage: DecimalValue | null;
  readonly highWaterDrawdownPercentage: DecimalValue | null;
  readonly consecutiveClosedLosingTrades: bigint | null;
  readonly reconciliationFailuresLast24Hours: bigint | null;
  readonly unauthorizedTransactionDetected: boolean | null;
  readonly authoritativeDisagreementDurationMs: bigint | null;
}

export interface CircuitBreakerDecision {
  readonly entryAllowed: boolean;
  readonly lockKind: EntryLockKind;
  readonly triggeredRuleIds: readonly string[];
  readonly results: readonly RuleResult[];
}

function thresholdTriggered(value: DecimalValue | null, threshold: Decimal): boolean | null {
  return value === null ? null : value.gte(threshold);
}

export function evaluateCircuitBreakers(snapshot: CircuitBreakerSnapshot): CircuitBreakerDecision {
  if (snapshot.evidence.length === 0) throw new TypeError("Circuit-breaker evidence is required");
  const start = snapshot.utcDayStartingEquitySol;
  const realizedRate =
    start !== null && start.gt(0) && snapshot.dailyRealizedLossSol !== null
      ? snapshot.dailyRealizedLossSol.div(start).mul(100)
      : null;
  const combinedRate =
    start !== null &&
    start.gt(0) &&
    snapshot.dailyRealizedLossSol !== null &&
    snapshot.executableUnrealizedLossSol !== null
      ? snapshot.dailyRealizedLossSol.plus(snapshot.executableUnrealizedLossSol).div(start).mul(100)
      : null;
  const checks = [
    [
      "CBR-001",
      thresholdTriggered(realizedRate === null ? null : asDecimal(realizedRate), new Decimal(2)),
      "Daily realised loss reached 2%",
    ],
    [
      "CBR-002",
      thresholdTriggered(combinedRate === null ? null : asDecimal(combinedRate), new Decimal(3)),
      "Daily combined loss reached 3%",
    ],
    [
      "CBR-003",
      thresholdTriggered(snapshot.rollingSevenDayDrawdownPercentage, new Decimal(6)),
      "Seven-day drawdown reached 6%",
    ],
    [
      "CBR-004",
      thresholdTriggered(snapshot.highWaterDrawdownPercentage, new Decimal(8)),
      "High-water drawdown reached 8%",
    ],
    [
      "CBR-005",
      snapshot.consecutiveClosedLosingTrades === null
        ? null
        : snapshot.consecutiveClosedLosingTrades >= 3n,
      "Three consecutive losing trades occurred",
    ],
    [
      "CBR-006",
      snapshot.reconciliationFailuresLast24Hours === null
        ? null
        : snapshot.reconciliationFailuresLast24Hours >= 2n,
      "Two reconciliation failures occurred within 24 hours",
    ],
    [
      "CBR-007",
      snapshot.unauthorizedTransactionDetected,
      "An unauthorized transaction was detected",
    ],
    [
      "CBR-008",
      snapshot.authoritativeDisagreementDurationMs === null
        ? null
        : snapshot.authoritativeDisagreementDurationMs > 60_000n,
      "Authoritative disagreement exceeded 60 seconds",
    ],
  ] as const;
  const results = Object.freeze(
    checks.map(([id, triggered, reason]) =>
      createRuleResult({
        ruleId: asRuleId(id),
        outcome: triggered === null ? "unknown" : triggered ? "fail" : "pass",
        evaluatedAt: snapshot.observedAt,
        evidence: snapshot.evidence,
        measurements: [],
        reason,
      }),
    ),
  );
  const triggeredRuleIds = Object.freeze(
    results.filter(({ outcome }) => outcome !== "pass").map(({ ruleId }) => ruleId as string),
  );
  const protectedLock = triggeredRuleIds.some((id) =>
    ["CBR-003", "CBR-004", "CBR-006", "CBR-007", "CBR-008"].includes(id),
  );
  return Object.freeze({
    entryAllowed: triggeredRuleIds.length === 0,
    lockKind:
      triggeredRuleIds.length === 0 ? "none" : protectedLock ? "protected" : "operator_resumable",
    triggeredRuleIds,
    results,
  });
}
