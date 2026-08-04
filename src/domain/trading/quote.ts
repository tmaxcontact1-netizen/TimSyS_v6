import { Decimal } from "decimal.js";

import { InvariantViolationError } from "../shared/errors.js";
import {
  createRuleResult,
  type EvidenceReference,
  type RuleMeasurement,
  type RuleResult,
} from "../shared/evidence.js";
import {
  asDecimal,
  asRuleId,
  asTimestamp,
  type BasisPoints,
  type DecimalValue,
  type MintAddress,
  type Percentage,
  type RawAmount,
  type SolanaSlot,
  type Timestamp,
} from "../shared/types.js";

const MAX_QUOTE_AGE_MS = 2_000;
const REQUIRED_SLIPPAGE_BPS = 150n;
const MAX_ENTRY_IMPACT_PERCENT = new Decimal(2);
const MAX_REVERSE_IMPACT_PERCENT = new Decimal(3);
const MAX_ROUND_TRIP_LOSS_PERCENT = new Decimal(5);
const MAX_EXECUTION_COST_PERCENT = new Decimal(1);
const APPROVAL_LIFETIME_MS = 15_000;

export type EntryGateStage = "approval" | "signing";

export interface ExecutableQuote {
  readonly fingerprint: string;
  readonly inputMint: MintAddress;
  readonly outputMint: MintAddress;
  readonly inputAmount: RawAmount;
  readonly expectedOutputAmount: RawAmount;
  readonly minimumOutputAmount: RawAmount;
  readonly slippageBasisPoints: BasisPoints;
  readonly priceImpactPercentage: Percentage | null;
  readonly routePlan: readonly string[];
  readonly contextSlot: SolanaSlot | null;
  readonly requestedAt: Timestamp;
  readonly receivedAt: Timestamp;
  readonly evidence: readonly EvidenceReference[];
}

export interface SimulationResult {
  readonly succeeded: boolean | null;
  readonly contextSlot: SolanaSlot | null;
  readonly quoteFingerprint: string | null;
}

export interface FinalRecalculation {
  readonly securityRulesPassed: boolean | null;
  readonly exposureRulesPassed: boolean | null;
  readonly quoteFingerprint: string | null;
}

export interface EntryApproval {
  readonly issuedAt: Timestamp;
  readonly expiresAt: Timestamp;
  readonly eligibilityHash: string;
  readonly quoteFingerprint: string;
}

export interface EntryGateSnapshot {
  readonly stage: EntryGateStage;
  readonly evaluatedAt: Timestamp;
  readonly entryQuote: ExecutableQuote | null;
  readonly reverseQuote: ExecutableQuote | null;
  readonly positionValueSol: DecimalValue | null;
  readonly estimatedExecutionCostsSol: DecimalValue | null;
  readonly simulation: SimulationResult | null;
  readonly finalRecalculation: FinalRecalculation | null;
  readonly approval: EntryApproval | null;
  readonly currentEligibilityHash: string | null;
  readonly submissionFailed: boolean | null;
}

export interface EntryGateDecision {
  readonly eligible: boolean;
  readonly requiresNewQuoteAndEvaluation: boolean;
  readonly quoteAgeMilliseconds: bigint | null;
  readonly expectedRoundTripLossPercentage: DecimalValue | null;
  readonly executionCostPercentage: DecimalValue | null;
  readonly results: readonly RuleResult[];
  readonly failedRuleIds: readonly string[];
}

function requireText(value: string, label: string): void {
  if (value.trim().length === 0) throw new InvariantViolationError(`${label} is required`);
}

function timestampMilliseconds(value: Timestamp): number {
  return new Date(value).getTime();
}

export function createExecutableQuote(input: ExecutableQuote): ExecutableQuote {
  requireText(input.fingerprint, "Quote fingerprint");
  if (input.inputMint === input.outputMint) {
    throw new InvariantViolationError("Quote input and output mints must differ");
  }
  if (input.inputAmount <= 0n || input.expectedOutputAmount <= 0n) {
    throw new InvariantViolationError("Quote input and expected output amounts must be positive");
  }
  if (input.minimumOutputAmount <= 0n || input.minimumOutputAmount > input.expectedOutputAmount) {
    throw new InvariantViolationError(
      "Quote minimum output must be positive and not exceed expected output",
    );
  }
  if (input.routePlan.length === 0 || input.routePlan.some((step) => step.trim().length === 0)) {
    throw new InvariantViolationError("Quote requires a non-empty route plan");
  }
  if (input.evidence.length === 0) {
    throw new InvariantViolationError("Quote requires source evidence");
  }
  if (timestampMilliseconds(input.receivedAt) < timestampMilliseconds(input.requestedAt)) {
    throw new InvariantViolationError("Quote cannot be received before it was requested");
  }

  return Object.freeze({
    ...input,
    routePlan: Object.freeze([...input.routePlan]),
    evidence: Object.freeze([...input.evidence]),
  });
}

export function createEntryApproval(input: Omit<EntryApproval, "expiresAt">): EntryApproval {
  requireText(input.eligibilityHash, "Approval eligibility hash");
  requireText(input.quoteFingerprint, "Approval quote fingerprint");
  return Object.freeze({
    ...input,
    expiresAt: asTimestamp(new Date(timestampMilliseconds(input.issuedAt) + APPROVAL_LIFETIME_MS)),
  });
}

export function createEntryGateSnapshot(input: EntryGateSnapshot): EntryGateSnapshot {
  if (input.positionValueSol !== null && input.positionValueSol.isNegative()) {
    throw new InvariantViolationError("Position value must be non-negative");
  }
  if (input.estimatedExecutionCostsSol !== null && input.estimatedExecutionCostsSol.isNegative()) {
    throw new InvariantViolationError("Estimated execution costs must be non-negative");
  }
  if (input.approval !== null) {
    requireText(input.approval.eligibilityHash, "Approval eligibility hash");
    requireText(input.approval.quoteFingerprint, "Approval quote fingerprint");
    if (
      timestampMilliseconds(input.approval.expiresAt) -
        timestampMilliseconds(input.approval.issuedAt) !==
      APPROVAL_LIFETIME_MS
    ) {
      throw new InvariantViolationError("Approval lifetime must equal fifteen seconds");
    }
  }
  return Object.freeze({
    ...input,
    simulation: input.simulation === null ? null : Object.freeze({ ...input.simulation }),
    finalRecalculation:
      input.finalRecalculation === null ? null : Object.freeze({ ...input.finalRecalculation }),
    approval: input.approval === null ? null : Object.freeze({ ...input.approval }),
  });
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

function result(
  snapshot: EntryGateSnapshot,
  evidence: readonly EvidenceReference[],
  id: string,
  passes: boolean,
  reason: string,
  measurements: readonly RuleMeasurement[],
): RuleResult {
  return createRuleResult({
    ruleId: asRuleId(id),
    outcome: passes ? "pass" : "fail",
    evaluatedAt: snapshot.evaluatedAt,
    evidence,
    measurements,
    reason,
  });
}

function quoteAge(snapshot: EntryGateSnapshot): number | null {
  if (snapshot.entryQuote === null) return null;
  return (
    timestampMilliseconds(snapshot.evaluatedAt) -
    timestampMilliseconds(snapshot.entryQuote.receivedAt)
  );
}

function roundTripLoss(snapshot: EntryGateSnapshot): Decimal | null {
  const entry = snapshot.entryQuote;
  const reverse = snapshot.reverseQuote;
  if (entry === null || reverse === null || entry.inputAmount <= 0n) return null;
  return new Decimal(entry.inputAmount.toString())
    .minus(reverse.expectedOutputAmount.toString())
    .div(entry.inputAmount.toString())
    .mul(100);
}

function executionCostPercentage(snapshot: EntryGateSnapshot): Decimal | null {
  if (
    snapshot.positionValueSol === null ||
    snapshot.estimatedExecutionCostsSol === null ||
    snapshot.positionValueSol.lte(0)
  ) {
    return null;
  }
  return snapshot.estimatedExecutionCostsSol.div(snapshot.positionValueSol).mul(100);
}

export function evaluateEntryGate(snapshot: EntryGateSnapshot): EntryGateDecision {
  const entry = snapshot.entryQuote;
  const reverse = snapshot.reverseQuote;
  const ageMs = quoteAge(snapshot);
  const lossPercentage = roundTripLoss(snapshot);
  const costPercentage = executionCostPercentage(snapshot);
  const evidence = Object.freeze([...(entry?.evidence ?? []), ...(reverse?.evidence ?? [])]);
  const reverseMatchesEntry =
    entry !== null &&
    reverse !== null &&
    reverse.inputMint === entry.outputMint &&
    reverse.outputMint === entry.inputMint &&
    reverse.inputAmount >= entry.expectedOutputAmount;
  const simulationCurrent =
    entry !== null &&
    snapshot.simulation?.succeeded === true &&
    snapshot.simulation.quoteFingerprint === entry.fingerprint &&
    entry.contextSlot !== null &&
    snapshot.simulation.contextSlot !== null &&
    snapshot.simulation.contextSlot >= entry.contextSlot;
  const recalculationCurrent =
    entry !== null &&
    snapshot.finalRecalculation?.securityRulesPassed === true &&
    snapshot.finalRecalculation.exposureRulesPassed === true &&
    snapshot.finalRecalculation.quoteFingerprint === entry.fingerprint;
  const approvalValid =
    entry !== null &&
    snapshot.approval !== null &&
    snapshot.currentEligibilityHash !== null &&
    snapshot.approval.eligibilityHash === snapshot.currentEligibilityHash &&
    snapshot.approval.quoteFingerprint === entry.fingerprint &&
    timestampMilliseconds(snapshot.evaluatedAt) >=
      timestampMilliseconds(snapshot.approval.issuedAt) &&
    timestampMilliseconds(snapshot.evaluatedAt) <=
      timestampMilliseconds(snapshot.approval.expiresAt);

  const firstNine = [
    result(
      snapshot,
      evidence,
      "ENT-001",
      ageMs !== null && ageMs >= 0 && ageMs <= MAX_QUOTE_AGE_MS,
      "The executable entry quote must be no older than two seconds at approval and signing",
      [
        measurement("gate_stage", snapshot.stage),
        measurement("quote_age", ageMs === null ? null : BigInt(ageMs), "milliseconds"),
      ],
    ),
    result(
      snapshot,
      evidence,
      "ENT-002",
      entry?.priceImpactPercentage !== null &&
        entry?.priceImpactPercentage !== undefined &&
        entry.priceImpactPercentage.lte(MAX_ENTRY_IMPACT_PERCENT),
      "Entry price impact must not exceed 2%",
      [measurement("entry_price_impact", entry?.priceImpactPercentage ?? null, "percent")],
    ),
    result(
      snapshot,
      evidence,
      "ENT-003",
      entry?.slippageBasisPoints === REQUIRED_SLIPPAGE_BPS,
      "Entry slippage tolerance must equal 150 basis points",
      [measurement("slippage", entry?.slippageBasisPoints ?? null, "basis_points")],
    ),
    result(
      snapshot,
      evidence,
      "ENT-004",
      reverseMatchesEntry &&
        reverse.priceImpactPercentage !== null &&
        reverse.priceImpactPercentage.lte(MAX_REVERSE_IMPACT_PERCENT),
      "The executable reverse quote must cover all expected tokens and have no more than 3% impact",
      [
        measurement("reverse_covers_expected_output", reverseMatchesEntry),
        measurement("reverse_price_impact", reverse?.priceImpactPercentage ?? null, "percent"),
      ],
    ),
    result(
      snapshot,
      evidence,
      "ENT-005",
      lossPercentage !== null &&
        lossPercentage.gte(0) &&
        lossPercentage.lte(MAX_ROUND_TRIP_LOSS_PERCENT),
      "Expected round-trip loss before market movement must not exceed 5%",
      [measurement("round_trip_loss", lossPercentage, "percent")],
    ),
    result(
      snapshot,
      evidence,
      "ENT-006",
      costPercentage !== null && costPercentage.lte(MAX_EXECUTION_COST_PERCENT),
      "Priority fee, tip, and network cost combined must not exceed 1% of position value",
      [measurement("execution_cost", costPercentage, "percent")],
    ),
    result(
      snapshot,
      evidence,
      "ENT-007",
      simulationCurrent,
      "Simulation must succeed against a current block context for the final quote",
      [measurement("simulation_current", simulationCurrent)],
    ),
    result(
      snapshot,
      evidence,
      "ENT-008",
      recalculationCurrent,
      "Exposure and security rules must pass after the final quote",
      [measurement("final_recalculation_current", recalculationCurrent)],
    ),
    result(
      snapshot,
      evidence,
      "ENT-009",
      approvalValid,
      "Approval must be unexpired and bound to the current quote and eligibility hash",
      [measurement("approval_valid", approvalValid)],
    ),
  ];
  const invalidated =
    firstNine.some(({ outcome }) => outcome === "fail") || snapshot.submissionFailed !== false;
  const results = Object.freeze([
    ...firstNine,
    result(
      snapshot,
      evidence,
      "ENT-010",
      !invalidated,
      "Expiry, quote change, failed simulation, failed submission, or gate failure requires a new quote and evaluation",
      [
        measurement("submission_failed", snapshot.submissionFailed),
        measurement("requires_new_quote", invalidated),
      ],
    ),
  ]);
  const failedRuleIds = Object.freeze(
    results.filter(({ outcome }) => outcome === "fail").map(({ ruleId }) => ruleId as string),
  );
  return Object.freeze({
    eligible: failedRuleIds.length === 0,
    requiresNewQuoteAndEvaluation: invalidated,
    quoteAgeMilliseconds: ageMs === null ? null : BigInt(ageMs),
    expectedRoundTripLossPercentage: lossPercentage === null ? null : asDecimal(lossPercentage),
    executionCostPercentage: costPercentage === null ? null : asDecimal(costPercentage),
    results,
    failedRuleIds,
  });
}
