import { Decimal } from "decimal.js";

import { InvariantViolationError } from "../shared/errors.js";
import {
  createRuleResult,
  type EvidenceReference,
  type RuleMeasurement,
  type RuleResult,
} from "../shared/evidence.js";
import { createStateMachine } from "../shared/state-machine.js";
import {
  asDecimal,
  asRuleId,
  type DecimalValue,
  type OrderId,
  type PositionId,
  type RawAmount,
  type Timestamp,
} from "../shared/types.js";

export type OrderSide = "buy" | "sell";
export type OrderState =
  | "planned"
  | "quoted"
  | "simulated"
  | "approved"
  | "signing"
  | "submitted"
  | "confirming"
  | "confirmed"
  | "reconciled"
  | "failed"
  | "cancelled";

export const orderStateMachine = createStateMachine<OrderState>({
  planned: ["quoted", "cancelled"],
  quoted: ["simulated", "cancelled"],
  simulated: ["approved", "cancelled"],
  approved: ["signing", "cancelled"],
  signing: ["submitted", "failed"],
  submitted: ["confirming", "confirmed", "failed"],
  confirming: ["confirmed", "failed"],
  confirmed: ["reconciled", "failed"],
  reconciled: [],
  failed: ["signing"],
  cancelled: [],
});

export interface Order {
  readonly id: OrderId;
  readonly side: OrderSide;
  readonly state: OrderState;
  readonly intendedInputAmount: RawAmount;
  readonly quoteFingerprint: string;
  readonly idempotencyKey: string;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  readonly version: bigint;
}

export type SubmissionAttemptState = "created" | "submitted" | "confirmed" | "failed";

export interface SubmissionAttempt {
  readonly orderId: OrderId;
  readonly attemptNumber: bigint;
  readonly state: SubmissionAttemptState;
  readonly route: string;
  readonly quoteFingerprint: string;
  readonly intendedInputAmount: RawAmount;
  readonly signature: string | null;
  readonly createdAt: Timestamp;
  readonly submittedAt: Timestamp | null;
  readonly confirmedAt: Timestamp | null;
  readonly errorCode: string | null;
}

export interface EntryReconciliation {
  readonly evaluatedAt: Timestamp;
  readonly transactionConfirmed: boolean | null;
  readonly onChainError: boolean | null;
  readonly tokenBalanceIncrease: RawAmount | null;
  readonly solBalanceDecrease: RawAmount | null;
  readonly feePaid: RawAmount | null;
  readonly tipPaid: RawAmount | null;
  readonly minimumOutputAmount: RawAmount;
  readonly signature: string | null;
  readonly evidence: readonly EvidenceReference[];
}

export interface EntryExecutionDecision {
  readonly successfulEntry: boolean;
  readonly actualReceivedAmount: RawAmount | null;
  readonly actualSolExpenditure: RawAmount | null;
  readonly realisedEntryPrice: DecimalValue | null;
  readonly results: readonly RuleResult[];
  readonly failedRuleIds: readonly string[];
}

export interface EmergencyExitIntent {
  readonly order: Order;
  readonly positionId: PositionId;
  readonly positionVersion: bigint;
  readonly emergencyRuleIds: readonly string[];
  readonly requestedAmount: RawAmount;
  readonly evidenceFingerprint: string;
}

export interface ExitReconciliation {
  readonly evaluatedAt: Timestamp;
  readonly transactionConfirmed: boolean | null;
  readonly onChainError: boolean | null;
  readonly tokenBalanceDecrease: RawAmount | null;
  readonly reconciledRemainingAmount: RawAmount | null;
  readonly solBalanceIncrease: RawAmount | null;
  readonly feePaid: RawAmount | null;
  readonly tipPaid: RawAmount | null;
  readonly signature: string | null;
  readonly expectedSignature: string;
  readonly evidence: readonly EvidenceReference[];
}

export interface ExitExecutionDecision {
  readonly reconciled: boolean;
  readonly closed: boolean;
  readonly requiresContinuation: boolean;
  readonly soldAmount: RawAmount | null;
  readonly remainingAmount: RawAmount | null;
  readonly proceedsSol: DecimalValue | null;
  readonly results: readonly RuleResult[];
  readonly failedRuleIds: readonly string[];
}

export interface ExitRetryPlan {
  readonly nextAttemptNumber: bigint;
  readonly refreshQuote: true;
  readonly refreshBlockhash: true;
  readonly refreshPriorityFee: true;
  readonly raisePriorityOneTier: boolean;
  readonly useFallbackSubmission: boolean;
  readonly criticalAlert: boolean;
  readonly earliestRetryAt: Timestamp;
  readonly latestAutomaticAttemptAt: Timestamp | null;
}

function requireText(value: string, label: string): void {
  if (value.trim().length === 0) throw new InvariantViolationError(`${label} is required`);
}

function milliseconds(value: Timestamp): number {
  return new Date(value).getTime();
}

export function createOrder(input: Order): Order {
  if (input.intendedInputAmount <= 0n)
    throw new InvariantViolationError("Order intended input amount must be positive");
  requireText(input.quoteFingerprint, "Order quote fingerprint");
  requireText(input.idempotencyKey, "Order idempotency key");
  if (input.version < 0n) throw new InvariantViolationError("Order version must be non-negative");
  if (milliseconds(input.updatedAt) < milliseconds(input.createdAt))
    throw new InvariantViolationError("Order cannot be updated before creation");
  return Object.freeze({ ...input });
}

export function transitionOrder(order: Order, next: OrderState, at: Timestamp): Order {
  if (milliseconds(at) < milliseconds(order.updatedAt))
    throw new InvariantViolationError("Order transition time cannot move backwards");
  orderStateMachine.transition(order.state, next);
  return Object.freeze({ ...order, state: next, updatedAt: at, version: order.version + 1n });
}

export function createSubmissionAttempt(
  order: Order,
  priorAttempts: readonly SubmissionAttempt[],
  route: string,
  at: Timestamp,
): SubmissionAttempt {
  if (order.state !== "signing")
    throw new InvariantViolationError("Submission attempt requires an order in signing state");
  requireText(route, "Submission route");
  const related = priorAttempts.filter((attempt) => attempt.orderId === order.id);
  const expected = BigInt(related.length + 1);
  const numbers = related
    .map(({ attemptNumber }) => attemptNumber)
    .sort((a, b) => (a < b ? -1 : 1));
  if (numbers.some((number, index) => number !== BigInt(index + 1)))
    throw new InvariantViolationError("Prior submission attempts must be contiguous and unique");
  if (related.some((attempt) => attempt.state !== "failed"))
    throw new InvariantViolationError("Only a failed submission attempt may be retried");
  return Object.freeze({
    orderId: order.id,
    attemptNumber: expected,
    state: "created",
    route,
    quoteFingerprint: order.quoteFingerprint,
    intendedInputAmount: order.intendedInputAmount,
    signature: null,
    createdAt: at,
    submittedAt: null,
    confirmedAt: null,
    errorCode: null,
  });
}

export function markAttemptSubmitted(
  attempt: SubmissionAttempt,
  signature: string,
  at: Timestamp,
): SubmissionAttempt {
  if (attempt.state !== "created")
    throw new InvariantViolationError("Only a created attempt may be submitted");
  requireText(signature, "Transaction signature");
  if (milliseconds(at) < milliseconds(attempt.createdAt))
    throw new InvariantViolationError("Submission time cannot precede attempt creation");
  return Object.freeze({ ...attempt, state: "submitted", signature, submittedAt: at });
}

export function markAttemptConfirmed(attempt: SubmissionAttempt, at: Timestamp): SubmissionAttempt {
  if (attempt.state !== "submitted")
    throw new InvariantViolationError("Only a submitted attempt may be confirmed");
  if (attempt.submittedAt === null || milliseconds(at) < milliseconds(attempt.submittedAt))
    throw new InvariantViolationError("Confirmation time cannot precede submission");
  return Object.freeze({ ...attempt, state: "confirmed", confirmedAt: at });
}

export function markAttemptFailed(
  attempt: SubmissionAttempt,
  errorCode: string,
): SubmissionAttempt {
  if (attempt.state === "confirmed" || attempt.state === "failed")
    throw new InvariantViolationError("Terminal submission attempt cannot fail again");
  requireText(errorCode, "Submission error code");
  return Object.freeze({ ...attempt, state: "failed", errorCode });
}

function rule(
  input: Pick<EntryReconciliation, "evaluatedAt" | "evidence">,
  id: string,
  passes: boolean,
  reason: string,
  measurements: readonly RuleMeasurement[],
): RuleResult {
  return createRuleResult({
    ruleId: asRuleId(id),
    outcome: passes ? "pass" : "fail",
    evaluatedAt: input.evaluatedAt,
    evidence: input.evidence,
    measurements,
    reason,
  });
}

export function evaluateSuccessfulEntry(input: EntryReconciliation): EntryExecutionDecision {
  if (input.minimumOutputAmount <= 0n)
    throw new InvariantViolationError("Minimum output amount must be positive");
  if (input.evidence.length === 0)
    throw new InvariantViolationError("Entry reconciliation requires evidence");

  const confirmed = input.transactionConfirmed === true && input.onChainError === false;
  const balancesChanged =
    input.tokenBalanceIncrease !== null &&
    input.tokenBalanceIncrease > 0n &&
    input.solBalanceDecrease !== null &&
    input.solBalanceDecrease > 0n;
  const amountsKnown =
    input.tokenBalanceIncrease !== null &&
    input.solBalanceDecrease !== null &&
    input.feePaid !== null &&
    input.tipPaid !== null;
  const realisedPrice = balancesChanged
    ? asDecimal(
        new Decimal(input.solBalanceDecrease!.toString()).div(
          input.tokenBalanceIncrease!.toString(),
        ),
      )
    : null;
  const minimumMet =
    input.tokenBalanceIncrease !== null && input.tokenBalanceIncrease >= input.minimumOutputAmount;
  const signatureSupported = input.signature !== null && input.signature.trim().length > 0;

  const results = Object.freeze([
    rule(input, "EXE-001", confirmed, "Transaction must confirm without an on-chain error", [
      { name: "transaction_confirmed", value: input.transactionConfirmed },
      { name: "on_chain_error", value: input.onChainError },
    ]),
    rule(
      input,
      "EXE-002",
      balancesChanged,
      "Reconciled token and SOL balances must move in the entry direction",
      [
        { name: "token_balance_increase", value: input.tokenBalanceIncrease, unit: "raw" },
        { name: "sol_balance_decrease", value: input.solBalanceDecrease, unit: "lamports" },
      ],
    ),
    rule(
      input,
      "EXE-003",
      amountsKnown,
      "Received quantity, expenditure, fees, and tips must be known",
      [{ name: "amounts_known", value: amountsKnown }],
    ),
    rule(
      input,
      "EXE-004",
      realisedPrice !== null,
      "Realised entry price must be derived from reconciled balance changes",
      [{ name: "realised_entry_price", value: realisedPrice, unit: "lamports_per_raw_token" }],
    ),
    rule(
      input,
      "EXE-005",
      minimumMet,
      "Actual received amount must meet the transaction minimum output",
      [
        { name: "actual_received", value: input.tokenBalanceIncrease, unit: "raw" },
        { name: "minimum_output", value: input.minimumOutputAmount, unit: "raw" },
      ],
    ),
    rule(
      input,
      "EXE-006",
      confirmed &&
        balancesChanged &&
        amountsKnown &&
        realisedPrice !== null &&
        minimumMet &&
        signatureSupported,
      "A signature alone cannot establish a successful entry",
      [{ name: "signature_present", value: signatureSupported }],
    ),
  ]);
  const failedRuleIds = Object.freeze(
    results.filter(({ outcome }) => outcome !== "pass").map(({ ruleId }) => ruleId as string),
  );
  return Object.freeze({
    successfulEntry: failedRuleIds.length === 0,
    actualReceivedAmount: input.tokenBalanceIncrease,
    actualSolExpenditure: input.solBalanceDecrease,
    realisedEntryPrice: realisedPrice,
    results,
    failedRuleIds,
  });
}

export function createEmergencyExitIntent(input: {
  readonly orderId: OrderId;
  readonly positionId: PositionId;
  readonly positionVersion: bigint;
  readonly currentAmount: RawAmount;
  readonly quoteFingerprint: string;
  readonly emergencyRuleIds: readonly string[];
  readonly evidence: readonly EvidenceReference[];
  readonly quoteFresh: boolean;
  readonly sellRouteValid: boolean;
  readonly simulationSucceeded: boolean;
  readonly createdAt: Timestamp;
}): EmergencyExitIntent {
  if (input.positionVersion < 0n) throw new InvariantViolationError("Position version is invalid");
  if (input.currentAmount <= 0n)
    throw new InvariantViolationError("Emergency exit amount must be positive");
  if (
    input.emergencyRuleIds.length === 0 ||
    input.emergencyRuleIds.some((id) => !/^EMG-\d{3}$/.test(id))
  )
    throw new InvariantViolationError("Emergency exit requires triggered emergency rules");
  if (input.evidence.length === 0)
    throw new InvariantViolationError("Emergency exit requires evidence");
  if (!input.quoteFresh || !input.sellRouteValid || !input.simulationSucceeded)
    throw new InvariantViolationError("Emergency exit requires a fresh valid simulated sell quote");
  const evidenceFingerprint = [...input.evidence]
    .map(
      ({ id, provider, observedAt, sourceKey, slot }) =>
        `${id}:${provider}:${observedAt}:${sourceKey}:${slot?.toString() ?? ""}`,
    )
    .sort()
    .join("|");
  const ruleBinding = [...new Set(input.emergencyRuleIds)].sort().join(",");
  const idempotencyKey = `emergency:${input.positionId}:${input.positionVersion}:${ruleBinding}:${evidenceFingerprint}`;
  return Object.freeze({
    order: createOrder({
      id: input.orderId,
      side: "sell",
      state: "planned",
      intendedInputAmount: input.currentAmount,
      quoteFingerprint: input.quoteFingerprint,
      idempotencyKey,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      version: 0n,
    }),
    positionId: input.positionId,
    positionVersion: input.positionVersion,
    emergencyRuleIds: Object.freeze([...new Set(input.emergencyRuleIds)].sort()),
    requestedAmount: input.currentAmount,
    evidenceFingerprint,
  });
}

export function planExitRetry(
  failedAttempts: readonly SubmissionAttempt[],
  failedAt: Timestamp,
): ExitRetryPlan {
  if (failedAttempts.length === 0 || failedAttempts.some(({ state }) => state !== "failed"))
    throw new InvariantViolationError("Exit retry requires failed attempts");
  const ordered = [...failedAttempts].sort((a, b) => Number(a.attemptNumber - b.attemptNumber));
  if (new Set(ordered.map(({ orderId }) => orderId)).size !== 1)
    throw new InvariantViolationError("Failed exit attempts must belong to one order");
  if (ordered.some(({ attemptNumber }, index) => attemptNumber !== BigInt(index + 1)))
    throw new InvariantViolationError("Failed exit attempts must be contiguous");
  const count = ordered.length;
  const delay = count >= 5 ? 10_000 : 0;
  return Object.freeze({
    nextAttemptNumber: BigInt(count + 1),
    refreshQuote: true,
    refreshBlockhash: true,
    refreshPriorityFee: true,
    raisePriorityOneTier: count >= 2,
    useFallbackSubmission: count >= 3,
    criticalAlert: count >= 5,
    earliestRetryAt: new Date(milliseconds(failedAt) + delay).toISOString() as Timestamp,
    latestAutomaticAttemptAt:
      count < 5 ? (new Date(milliseconds(failedAt) + 3_000).toISOString() as Timestamp) : null,
  });
}

export function evaluateSuccessfulExit(
  intent: EmergencyExitIntent,
  input: ExitReconciliation,
): ExitExecutionDecision {
  if (input.evidence.length === 0)
    throw new InvariantViolationError("Exit reconciliation requires evidence");
  requireText(input.expectedSignature, "Expected transaction signature");
  const confirmed = input.transactionConfirmed === true && input.onChainError === false;
  const signatureMatches = input.signature !== null && input.signature === input.expectedSignature;
  const amountsKnown =
    input.tokenBalanceDecrease !== null &&
    input.reconciledRemainingAmount !== null &&
    input.solBalanceIncrease !== null &&
    input.feePaid !== null &&
    input.tipPaid !== null;
  const balancesValid =
    amountsKnown &&
    input.tokenBalanceDecrease! > 0n &&
    input.tokenBalanceDecrease! <= intent.requestedAmount &&
    input.reconciledRemainingAmount! === intent.requestedAmount - input.tokenBalanceDecrease!;
  const reconciled = confirmed && signatureMatches && amountsKnown && balancesValid;
  const results = Object.freeze([
    rule(
      input,
      "RET-006",
      reconciled,
      "Closure requires the submitted transaction and authoritative balances to reconcile",
      [
        { name: "transaction_confirmed", value: input.transactionConfirmed },
        { name: "on_chain_error", value: input.onChainError },
        { name: "signature_matches", value: signatureMatches },
        { name: "amounts_known", value: amountsKnown },
        { name: "balances_reconciled", value: balancesValid },
        { name: "token_balance_decrease", value: input.tokenBalanceDecrease, unit: "raw" },
        { name: "remaining_amount", value: input.reconciledRemainingAmount, unit: "raw" },
      ],
    ),
  ]);
  const failedRuleIds = Object.freeze(
    results.filter(({ outcome }) => outcome !== "pass").map(({ ruleId }) => ruleId as string),
  );
  const closed = reconciled && input.reconciledRemainingAmount === 0n;
  return Object.freeze({
    reconciled,
    closed,
    requiresContinuation: reconciled && !closed,
    soldAmount: reconciled ? input.tokenBalanceDecrease : null,
    remainingAmount: reconciled ? input.reconciledRemainingAmount : null,
    proceedsSol:
      reconciled && input.solBalanceIncrease !== null
        ? asDecimal(new Decimal(input.solBalanceIncrease.toString()).div(1_000_000_000))
        : null,
    results,
    failedRuleIds,
  });
}
