import { Decimal } from "decimal.js";

import { createRuleResult, type RuleMeasurement, type RuleResult } from "../shared/evidence.js";
import { asDecimal, asRuleId, type DecimalValue } from "../shared/types.js";
import type { PortfolioSnapshot } from "./model.js";

const PERMITTED_LOSS_RATE = new Decimal("0.005");
const HARD_STOP_RATE = new Decimal("0.15");
const MAX_POSITION_RATE = new Decimal("0.05");
const MAX_EXPOSURE_RATE = new Decimal("0.10");
const MIN_SOL_RESERVE_RATE = new Decimal("0.50");
const REENTRY_DELAY_MS = 6 * 60 * 60 * 1000;

export interface PositionSizingDecision {
  readonly eligible: boolean;
  readonly positionSizeSol: DecimalValue | null;
  readonly permittedLossSol: DecimalValue | null;
  readonly riskDerivedSizeSol: DecimalValue | null;
  readonly remainingExposureCapacitySol: DecimalValue | null;
  readonly reserveCapacitySol: DecimalValue | null;
  readonly results: readonly RuleResult[];
  readonly failedRuleIds: readonly string[];
}

function measurement(
  name: string,
  value: Decimal | bigint | boolean | string | null,
  unit?: string,
): RuleMeasurement {
  return {
    name,
    value: value instanceof Decimal ? asDecimal(value) : value,
    ...(unit ? { unit } : {}),
  };
}

function rule(
  snapshot: PortfolioSnapshot,
  id: string,
  passes: boolean,
  reason: string,
  measurements: readonly RuleMeasurement[],
): RuleResult {
  return createRuleResult({
    ruleId: asRuleId(id),
    outcome: passes ? "pass" : "fail",
    evaluatedAt: snapshot.observedAt,
    evidence: snapshot.evidence,
    measurements,
    reason,
  });
}

function minimum(values: readonly Decimal[]): Decimal {
  return values.reduce((current, value) => Decimal.min(current, value));
}

function millisecondsSinceClosure(snapshot: PortfolioSnapshot): number | null {
  if (snapshot.lastConfirmedClosureAt === null) return null;
  return (
    new Date(snapshot.observedAt).getTime() - new Date(snapshot.lastConfirmedClosureAt).getTime()
  );
}

export function evaluatePositionSize(snapshot: PortfolioSnapshot): PositionSizingDecision {
  const equity = snapshot.equitySol;
  const permittedLoss = equity?.mul(PERMITTED_LOSS_RATE) ?? null;
  const riskDerivedSize = permittedLoss?.div(HARD_STOP_RATE) ?? null;
  const equityPositionCap = equity?.mul(MAX_POSITION_RATE) ?? null;
  const maximumExposure = equity?.mul(MAX_EXPOSURE_RATE) ?? null;
  const remainingExposureCapacity =
    maximumExposure !== null && snapshot.openCostExposureSol !== null
      ? Decimal.max(0, maximumExposure.minus(snapshot.openCostExposureSol))
      : null;
  const requiredReserve = equity?.mul(MIN_SOL_RESERVE_RATE) ?? null;
  const reserveCapacity =
    snapshot.uncommittedSol !== null &&
    snapshot.estimatedEntryCostsSol !== null &&
    requiredReserve !== null
      ? Decimal.max(
          0,
          snapshot.uncommittedSol.minus(snapshot.estimatedEntryCostsSol).minus(requiredReserve),
        )
      : null;
  const sizingInputs = [
    riskDerivedSize,
    equityPositionCap,
    snapshot.liquidityCapacitySol,
    remainingExposureCapacity,
    reserveCapacity,
  ];
  const positionSize = sizingInputs.every((value) => value !== null)
    ? minimum(sizingInputs as Decimal[])
    : null;
  const closureAgeMs = millisecondsSinceClosure(snapshot);
  const reentryPass =
    snapshot.hasConfirmedPriorClosure === false ||
    (snapshot.hasConfirmedPriorClosure === true &&
      closureAgeMs !== null &&
      closureAgeMs >= REENTRY_DELAY_MS);
  const requestedSize =
    equity !== null && snapshot.requestedPositionPercentage !== null
      ? equity.mul(snapshot.requestedPositionPercentage).div(100)
      : null;
  const prohibitedRiskAction =
    snapshot.usesLeverageOrBorrowing === true || snapshot.increasesLosingPosition === true;

  const results = Object.freeze([
    rule(
      snapshot,
      "UNI-005",
      snapshot.openPositionCount !== null && snapshot.openPositionCount < 3n,
      "Fewer than three concurrent open positions are required before entry",
      [measurement("open_position_count", snapshot.openPositionCount)],
    ),
    rule(
      snapshot,
      "UNI-006",
      snapshot.hasNonClosedPositionForMint === false,
      "The mint must have no existing non-closed position",
      [measurement("has_non_closed_position_for_mint", snapshot.hasNonClosedPositionForMint)],
    ),
    rule(snapshot, "UNI-007", reentryPass, "Re-entry requires six hours after confirmed closure", [
      measurement("has_confirmed_prior_closure", snapshot.hasConfirmedPriorClosure),
      measurement(
        "milliseconds_since_closure",
        closureAgeMs === null ? null : BigInt(closureAgeMs),
        "milliseconds",
      ),
    ]),
    rule(
      snapshot,
      "RSK-001",
      equity !== null && equity.gt(0) && permittedLoss !== null,
      "Permitted loss must equal 0.5% of reconciled wallet equity",
      [measurement("equity", equity, "SOL"), measurement("permitted_loss", permittedLoss, "SOL")],
    ),
    rule(snapshot, "RSK-002", true, "Initial hard-stop distance is fixed at 15%", [
      measurement("hard_stop_distance", new Decimal(15), "percent"),
    ]),
    rule(
      snapshot,
      "RSK-003",
      riskDerivedSize !== null && riskDerivedSize.gt(0),
      "Risk-derived size must equal permitted loss divided by the 15% hard stop",
      [measurement("risk_derived_size", riskDerivedSize, "SOL")],
    ),
    rule(
      snapshot,
      "RSK-004",
      positionSize !== null &&
        positionSize.gt(0) &&
        (requestedSize === null || requestedSize.lte(positionSize)),
      "Position size must not exceed the minimum of all deterministic capacity limits",
      [
        measurement("position_size", positionSize, "SOL"),
        measurement("requested_size", requestedSize, "SOL"),
        measurement("liquidity_capacity", snapshot.liquidityCapacitySol, "SOL"),
      ],
    ),
    rule(
      snapshot,
      "RSK-005",
      equity !== null &&
        snapshot.openCostExposureSol !== null &&
        positionSize !== null &&
        snapshot.openCostExposureSol.plus(positionSize).lte(equity.mul(MAX_EXPOSURE_RATE)),
      "Combined open cost exposure must not exceed 10% of equity",
      [
        measurement("open_cost_exposure", snapshot.openCostExposureSol, "SOL"),
        measurement(
          "post_entry_exposure",
          snapshot.openCostExposureSol === null || positionSize === null
            ? null
            : snapshot.openCostExposureSol.plus(positionSize),
          "SOL",
        ),
      ],
    ),
    rule(
      snapshot,
      "RSK-006",
      equity !== null &&
        snapshot.uncommittedSol !== null &&
        snapshot.estimatedEntryCostsSol !== null &&
        positionSize !== null &&
        snapshot.uncommittedSol
          .minus(positionSize)
          .minus(snapshot.estimatedEntryCostsSol)
          .gte(equity.mul(MIN_SOL_RESERVE_RATE)),
      "At least 50% of equity must remain as uncommitted SOL after entry and estimated costs",
      [measurement("reserve_capacity", reserveCapacity, "SOL")],
    ),
    rule(
      snapshot,
      "RSK-007",
      snapshot.usesLeverageOrBorrowing === false &&
        snapshot.increasesLosingPosition === false &&
        !prohibitedRiskAction,
      "Leverage, borrowing, averaging down, and increasing a losing position are prohibited",
      [
        measurement("uses_leverage_or_borrowing", snapshot.usesLeverageOrBorrowing),
        measurement("increases_losing_position", snapshot.increasesLosingPosition),
      ],
    ),
  ]);

  const failedRuleIds = Object.freeze(
    results.filter(({ outcome }) => outcome === "fail").map(({ ruleId }) => ruleId as string),
  );
  return Object.freeze({
    eligible: failedRuleIds.length === 0,
    positionSizeSol: positionSize === null ? null : asDecimal(positionSize),
    permittedLossSol: permittedLoss === null ? null : asDecimal(permittedLoss),
    riskDerivedSizeSol: riskDerivedSize === null ? null : asDecimal(riskDerivedSize),
    remainingExposureCapacitySol:
      remainingExposureCapacity === null ? null : asDecimal(remainingExposureCapacity),
    reserveCapacitySol: reserveCapacity === null ? null : asDecimal(reserveCapacity),
    results,
    failedRuleIds,
  });
}
