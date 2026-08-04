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
  readonly emergencyExit: boolean;
  readonly evidence: readonly EvidenceReference[];
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
  if (snapshot.emergencyExit) {
    ruleId = "EMERGENCY";
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
