import { Decimal } from "decimal.js";

import { InvariantViolationError } from "../shared/errors.js";
import { createRuleResult, type EvidenceReference, type RuleResult } from "../shared/evidence.js";
import {
  asRuleId,
  asRawAmount,
  type DecimalValue,
  type RawAmount,
  type Timestamp,
} from "../shared/types.js";
import type { Position } from "./position.js";

export interface ExitSnapshot {
  readonly evaluatedAt: Timestamp;
  readonly executableValueSol: DecimalValue | null;
  readonly emergency: EmergencyExitSnapshot;
  readonly evidence: readonly EvidenceReference[];
}

export interface EmergencyExitSnapshot {
  readonly evaluatedAt: Timestamp;
  readonly liquidityUsd: DecimalValue | null;
  readonly liquidityUsdTenMinutesAgo: DecimalValue | null;
  readonly developerRelatedSoldPercentage: DecimalValue | null;
  readonly originatingTierASoldPercentage: DecimalValue | null;
  readonly confirmingTierBSoldPercentages: readonly [DecimalValue, DecimalValue] | null;
  readonly dangerousSecurityChangeDetected: boolean | null;
  readonly fullExitPriceImpactPercentages: readonly DecimalValue[] | null;
  readonly unexplainedBalanceDiscrepancy: boolean | null;
  readonly marketDataUnavailableSince: Timestamp | null;
  readonly marketDataAvailabilityKnown: boolean;
  readonly allChainAccessUnavailableSince: Timestamp | null;
  readonly chainAccessAvailabilityKnown: boolean;
  readonly evidence: readonly EvidenceReference[];
}

export interface EmergencyExitDecision {
  readonly evaluatedAt: Timestamp;
  readonly triggered: boolean;
  readonly ruleId: string | null;
  readonly triggeredRuleIds: readonly string[];
  readonly results: readonly RuleResult[];
}

export interface ExitDecision {
  readonly action: "none" | "partial" | "full";
  readonly ruleId: string | null;
  readonly requestedAmount: RawAmount;
  readonly results: readonly RuleResult[];
}

const HOUR = 3_600_000;
const elapsed = (from: Timestamp, to: Timestamp): number =>
  new Date(to).getTime() - new Date(from).getTime();

function emergencyResult(
  snapshot: EmergencyExitSnapshot,
  id: string,
  triggered: boolean | null,
  reason: string,
): RuleResult {
  return createRuleResult({
    ruleId: asRuleId(id),
    outcome: triggered === null ? "unknown" : triggered ? "fail" : "pass",
    evaluatedAt: snapshot.evaluatedAt,
    evidence: snapshot.evidence,
    measurements: [],
    reason,
  });
}

function validatePercentage(value: DecimalValue | null, label: string): void {
  if (value !== null && (value.isNegative() || value.gt(100)))
    throw new InvariantViolationError(`${label} must be between zero and 100`);
}

function unavailableFor(
  known: boolean,
  since: Timestamp | null,
  evaluatedAt: Timestamp,
  thresholdMilliseconds: number,
): boolean | null {
  if (!known) return null;
  if (since === null) return false;
  const duration = elapsed(since, evaluatedAt);
  if (duration < 0)
    throw new InvariantViolationError("Unavailability cannot begin after evaluation");
  return duration >= thresholdMilliseconds;
}

export function evaluateEmergencyExit(snapshot: EmergencyExitSnapshot): EmergencyExitDecision {
  if (snapshot.evidence.length === 0)
    throw new InvariantViolationError("Emergency exit evaluation requires evidence");
  for (const evidence of snapshot.evidence) {
    if (elapsed(evidence.observedAt, snapshot.evaluatedAt) < 0)
      throw new InvariantViolationError("Emergency evidence cannot be observed in the future");
  }
  for (const [value, label] of [
    [snapshot.developerRelatedSoldPercentage, "Developer/related sale percentage"],
    [snapshot.originatingTierASoldPercentage, "Tier A sale percentage"],
  ] as const)
    validatePercentage(value, label);
  if (snapshot.confirmingTierBSoldPercentages !== null)
    snapshot.confirmingTierBSoldPercentages.forEach((value) =>
      validatePercentage(value, "Tier B sale percentage"),
    );
  if (
    (snapshot.liquidityUsd !== null && snapshot.liquidityUsd.isNegative()) ||
    (snapshot.liquidityUsdTenMinutesAgo !== null && snapshot.liquidityUsdTenMinutesAgo.isNegative())
  )
    throw new InvariantViolationError("Liquidity must be non-negative");
  if (
    snapshot.fullExitPriceImpactPercentages !== null &&
    snapshot.fullExitPriceImpactPercentages.some((value) => value.isNegative() || value.gt(100))
  )
    throw new InvariantViolationError("Price impact must be between zero and 100");

  const liquidityDrop =
    snapshot.liquidityUsd === null || snapshot.liquidityUsdTenMinutesAgo === null
      ? null
      : snapshot.liquidityUsdTenMinutesAgo.isZero()
        ? false
        : snapshot.liquidityUsd.lte(snapshot.liquidityUsdTenMinutesAgo.mul("0.8"));
  const liquidityFloor = snapshot.liquidityUsd === null ? null : snapshot.liquidityUsd.lt(50_000);
  const developerSale =
    snapshot.developerRelatedSoldPercentage === null
      ? null
      : snapshot.developerRelatedSoldPercentage.gte(10);
  const tierASale =
    snapshot.originatingTierASoldPercentage === null
      ? null
      : snapshot.originatingTierASoldPercentage.gte(50);
  const tierBSales =
    snapshot.confirmingTierBSoldPercentages === null
      ? null
      : snapshot.confirmingTierBSoldPercentages.every((value) => value.gte(30));
  const impacts = snapshot.fullExitPriceImpactPercentages;
  const worseningImpact =
    impacts === null
      ? null
      : impacts.length < 3
        ? false
        : impacts.slice(-3)[2]!.gt(8) &&
          impacts.slice(-3)[1]!.gt(impacts.slice(-3)[0]!) &&
          impacts.slice(-3)[2]!.gt(impacts.slice(-3)[1]!);
  const marketUnavailable = unavailableFor(
    snapshot.marketDataAvailabilityKnown,
    snapshot.marketDataUnavailableSince,
    snapshot.evaluatedAt,
    60_000,
  );
  const chainUnavailable = unavailableFor(
    snapshot.chainAccessAvailabilityKnown,
    snapshot.allChainAccessUnavailableSince,
    snapshot.evaluatedAt,
    30_000,
  );
  const facts = [
    ["EMG-001", liquidityDrop, "Ten-minute liquidity decline"],
    ["EMG-002", liquidityFloor, "Emergency liquidity floor"],
    ["EMG-003", developerSale, "Developer/related wallet sales"],
    ["EMG-004", tierASale, "Originating Tier A wallet sale"],
    ["EMG-005", tierBSales, "Confirming Tier B wallet sales"],
    ["EMG-006", snapshot.dangerousSecurityChangeDetected, "New dangerous security fact"],
    ["EMG-007", worseningImpact, "Worsening full-exit price impact"],
    ["EMG-008", snapshot.unexplainedBalanceDiscrepancy, "Unexplained balance discrepancy"],
    ["EMG-009", marketUnavailable, "Required market-data outage"],
    ["EMG-010", chainUnavailable, "Complete chain-access outage"],
  ] as const;
  const triggeredRuleIds = Object.freeze(
    facts.filter(([, triggered]) => triggered === true).map(([id]) => id),
  );
  return Object.freeze({
    evaluatedAt: snapshot.evaluatedAt,
    triggered: triggeredRuleIds.length > 0,
    ruleId: triggeredRuleIds[0] ?? null,
    triggeredRuleIds,
    results: Object.freeze(
      facts.map(([id, triggered, reason]) => emergencyResult(snapshot, id, triggered, reason)),
    ),
  });
}

function result(snapshot: ExitSnapshot, id: string, passes: boolean, reason: string): RuleResult {
  return createRuleResult({
    ruleId: asRuleId(id),
    outcome: passes ? "pass" : "fail",
    evaluatedAt: snapshot.evaluatedAt,
    evidence: snapshot.evidence,
    measurements: [],
    reason,
  });
}

export function evaluateExit(position: Position, snapshot: ExitSnapshot): ExitDecision {
  if (position.state !== "open" && position.state !== "partially_closed")
    throw new InvariantViolationError("Exit evaluation requires an active position");
  if (snapshot.evidence.length === 0)
    throw new InvariantViolationError("Exit evaluation requires evidence");
  if (elapsed(position.updatedAt, snapshot.evaluatedAt) < 0)
    throw new InvariantViolationError("Exit evaluation time cannot move backwards");
  if (snapshot.executableValueSol !== null && snapshot.executableValueSol.isNegative())
    throw new InvariantViolationError("Executable value must be non-negative");
  if (elapsed(snapshot.emergency.evaluatedAt, snapshot.evaluatedAt) !== 0)
    throw new InvariantViolationError("Emergency decision must match exit evaluation time");
  const emergency = evaluateEmergencyExit(snapshot.emergency);

  const value = snapshot.executableValueSol;
  const returnRate = value === null ? null : value.div(position.remainingCostBasisSol).minus(1);
  const beforePartial = !position.firstTargetSatisfied && !position.secondTargetSatisfied;
  const stop =
    value !== null && beforePartial && value.lte(position.remainingCostBasisSol.mul("0.85"));
  const first =
    value !== null &&
    !position.firstTargetSatisfied &&
    value.gte(position.remainingCostBasisSol.mul("1.25"));
  const second =
    value !== null &&
    !position.secondTargetSatisfied &&
    value.gte(position.remainingCostBasisSol.mul("1.5"));
  const trailing =
    value !== null &&
    position.firstTargetSatisfied &&
    value.lte(position.peakExecutableValueSol.mul("0.85"));
  const sixHour =
    value !== null &&
    elapsed(position.openedAt, snapshot.evaluatedAt) >= 6 * HOUR &&
    returnRate !== null &&
    returnRate.lt("0.1");
  const day = elapsed(position.openedAt, snapshot.evaluatedAt) >= 24 * HOUR;
  const results = Object.freeze([
    ...emergency.results,
    result(snapshot, "EXT-001", stop, "Hard stop before partial exits"),
    result(snapshot, "EXT-002", first, "First profit target"),
    result(snapshot, "EXT-003", second, "Second profit target"),
    result(snapshot, "EXT-004", trailing, "Trailing protection after first target"),
    result(snapshot, "EXT-005", sixHour, "Six-hour underperformance exit"),
    result(snapshot, "EXT-006", day, "Twenty-four-hour exit"),
  ]);

  let ruleId: string | null = null;
  let action: ExitDecision["action"] = "none";
  let amount = 0n;
  if (emergency.triggered) {
    ruleId = emergency.ruleId;
    action = "full";
    amount = position.currentAmount;
  } else if (stop || trailing || sixHour || day) {
    ruleId = stop ? "EXT-001" : trailing ? "EXT-004" : day ? "EXT-006" : "EXT-005";
    action = "full";
    amount = position.currentAmount;
  } else if (second) {
    ruleId = "EXT-003";
    action = "partial";
    amount = (position.originalAmount * 30n) / 100n;
  } else if (first) {
    ruleId = "EXT-002";
    action = "partial";
    amount = (position.originalAmount * 40n) / 100n;
  }
  amount = BigInt(
    Decimal.min(
      new Decimal(amount.toString()),
      new Decimal(position.currentAmount.toString()),
    ).toFixed(0, Decimal.ROUND_DOWN),
  );
  return Object.freeze({ action, ruleId, requestedAmount: asRawAmount(amount), results });
}
