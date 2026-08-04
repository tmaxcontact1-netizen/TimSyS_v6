import { InvariantViolationError } from "../../domain/shared/errors.js";
import type { EvidenceReference } from "../../domain/shared/evidence.js";
import type {
  AuditEventId,
  OrderId,
  RawAmount,
  Timestamp,
  WalletAddress,
} from "../../domain/shared/types.js";
import type { SubmissionReceipt } from "../ports/signer.js";
import { evaluateExit, type ExitDecision, type ExitSnapshot } from "../../domain/trading/exits.js";
import {
  createEmergencyExitIntent,
  createStandardExitIntent,
  evaluateSuccessfulExit,
  type ExitExecutionDecision,
  type ExitExecutionIntent,
  type ExitReconciliation,
} from "../../domain/trading/order.js";
import {
  applyPositionEvent,
  restorePositionLifecycle,
  type PositionEvent,
  type PositionLifecycle,
} from "../../domain/trading/position.js";

export interface ProcessedRuntimeStep {
  readonly stepId: string;
  readonly fingerprint: string;
  readonly action: PositionRuntimeAction;
}

export interface PendingExit {
  readonly intent: ExitExecutionIntent;
  readonly decision: ExitDecision;
  readonly submission: SubmissionReceipt | null;
}

export interface PositionRuntimeState {
  readonly lifecycle: PositionLifecycle;
  readonly pendingExit: PendingExit | null;
  readonly processedSteps: readonly ProcessedRuntimeStep[];
}

export interface ExitPreparation {
  readonly orderId: OrderId;
  readonly quoteFingerprint: string;
  readonly quoteReceivedAt: Timestamp;
  readonly sellRouteValid: boolean;
  readonly simulationSucceeded: boolean;
  readonly execution: PreparedExitExecution;
  readonly evidence: readonly EvidenceReference[];
  readonly peakEventId: AuditEventId;
  readonly exitRequestedEventId: AuditEventId;
}

export interface PreparedExitExecution {
  readonly transactionFingerprint: string;
  readonly quoteFingerprint: string;
  readonly quoteReceivedAt: Timestamp;
  readonly wallet: WalletAddress;
  readonly serializedTransactionBase64: string;
  readonly lastValidBlockHeight: bigint;
  readonly prioritizationFeeLamports: RawAmount;
  readonly evidence: readonly EvidenceReference[];
}

export interface MonitorPositionStep {
  readonly type: "monitor";
  readonly stepId: string;
  readonly snapshot: ExitSnapshot;
  readonly preparation: ExitPreparation | null;
}

export interface ReconcilePositionStep {
  readonly type: "reconcile";
  readonly stepId: string;
  readonly reconciliation: ExitReconciliation;
  readonly eventId: AuditEventId;
}

export type PositionRuntimeStep = MonitorPositionStep | ReconcilePositionStep;

export type PositionRuntimeAction =
  | Readonly<{ type: "continue_monitoring"; decision: ExitDecision }>
  | Readonly<{
      type: "submit_exit";
      intent: ExitExecutionIntent;
      decision: ExitDecision;
      execution: PreparedExitExecution;
    }>
  | Readonly<{
      type: "await_reconciliation";
      reason: "pending" | "on_chain_failure" | "balance_mismatch";
      decision: ExitExecutionDecision;
    }>
  | Readonly<{ type: "refresh_exit"; decision: ExitExecutionDecision }>
  | Readonly<{ type: "exit_reconciled"; decision: ExitExecutionDecision }>
  | Readonly<{ type: "position_closed"; decision: ExitExecutionDecision }>;

export interface PositionRuntimeResult {
  readonly state: PositionRuntimeState;
  readonly actionId: string;
  readonly action: PositionRuntimeAction;
  readonly emittedEvents: readonly PositionEvent[];
}

const time = (value: Timestamp): number => new Date(value).getTime();

function requireText(value: string, label: string): void {
  if (value.trim().length === 0) throw new InvariantViolationError(`${label} is required`);
}

function evidenceFingerprint(evidence: readonly EvidenceReference[]): string {
  return [...evidence]
    .map(
      ({ id, provider, observedAt, sourceKey, slot }) =>
        `${id}:${provider}:${observedAt}:${sourceKey}:${slot?.toString() ?? ""}`,
    )
    .sort()
    .join("|");
}

function stepFingerprint(step: PositionRuntimeStep): string {
  if (step.type === "monitor") {
    const snapshot = step.snapshot;
    const emergency = snapshot.emergency;
    return [
      step.type,
      snapshot.evaluatedAt,
      snapshot.executableValueSol?.toString() ?? "unknown",
      emergency.evaluatedAt,
      emergency.liquidityUsd?.toString() ?? "unknown",
      emergency.liquidityUsdTenMinutesAgo?.toString() ?? "unknown",
      emergency.developerRelatedSoldPercentage?.toString() ?? "unknown",
      emergency.originatingTierASoldPercentage?.toString() ?? "unknown",
      emergency.confirmingTierBSoldPercentages?.map(String).join(",") ?? "unknown",
      String(emergency.dangerousSecurityChangeDetected),
      emergency.fullExitPriceImpactPercentages?.map(String).join(",") ?? "unknown",
      String(emergency.unexplainedBalanceDiscrepancy),
      emergency.marketDataUnavailableSince ?? "",
      String(emergency.marketDataAvailabilityKnown),
      emergency.allChainAccessUnavailableSince ?? "",
      String(emergency.chainAccessAvailabilityKnown),
      evidenceFingerprint(snapshot.evidence),
      evidenceFingerprint(emergency.evidence),
      step.preparation?.orderId ?? "",
      step.preparation?.quoteFingerprint ?? "",
      step.preparation?.quoteReceivedAt ?? "",
      String(step.preparation?.sellRouteValid ?? ""),
      String(step.preparation?.simulationSucceeded ?? ""),
      step.preparation?.execution.transactionFingerprint ?? "",
      step.preparation?.execution.quoteFingerprint ?? "",
      step.preparation?.execution.quoteReceivedAt ?? "",
      step.preparation?.execution.wallet ?? "",
      step.preparation?.execution.serializedTransactionBase64 ?? "",
      step.preparation?.execution.lastValidBlockHeight.toString() ?? "",
      step.preparation?.execution.prioritizationFeeLamports.toString() ?? "",
      step.preparation === null ? "" : evidenceFingerprint(step.preparation.execution.evidence),
      step.preparation === null ? "" : evidenceFingerprint(step.preparation.evidence),
      step.preparation?.peakEventId ?? "",
      step.preparation?.exitRequestedEventId ?? "",
    ].join("~");
  }
  const value = step.reconciliation;
  return [
    step.type,
    value.evaluatedAt,
    String(value.transactionConfirmed),
    String(value.onChainError),
    value.tokenBalanceDecrease?.toString() ?? "unknown",
    value.reconciledRemainingAmount?.toString() ?? "unknown",
    value.solBalanceIncrease?.toString() ?? "unknown",
    value.feePaid?.toString() ?? "unknown",
    value.tipPaid?.toString() ?? "unknown",
    value.signature ?? "",
    value.expectedSignature,
    evidenceFingerprint(value.evidence),
    step.eventId,
  ].join("~");
}

function freezeState(input: PositionRuntimeState): PositionRuntimeState {
  const lifecycle = restorePositionLifecycle(input.lifecycle);
  if (
    new Set(input.processedSteps.map(({ stepId }) => stepId)).size !== input.processedSteps.length
  )
    throw new InvariantViolationError("Runtime step IDs must be unique");
  for (const step of input.processedSteps) {
    requireText(step.stepId, "Runtime step ID");
    requireText(step.fingerprint, "Runtime step fingerprint");
  }
  if (input.pendingExit !== null) {
    const position = lifecycle.position;
    if (position === null || position.state !== "exit_pending")
      throw new InvariantViolationError("Pending exit requires an exit_pending position");
    if (input.pendingExit.intent.positionId !== position.id)
      throw new InvariantViolationError("Pending exit targets a different position");
    if (input.pendingExit.intent.positionVersion + 1n !== position.version)
      throw new InvariantViolationError("Pending exit version does not match position lifecycle");
  } else if (lifecycle.position?.state === "exit_pending") {
    throw new InvariantViolationError("Exit-pending position requires a pending exit intent");
  }
  return Object.freeze({
    lifecycle,
    pendingExit:
      input.pendingExit === null
        ? null
        : Object.freeze({
            intent: input.pendingExit.intent,
            decision: input.pendingExit.decision,
            submission:
              input.pendingExit.submission === null
                ? null
                : Object.freeze({ ...input.pendingExit.submission }),
          }),
    processedSteps: Object.freeze(input.processedSteps.map((step) => Object.freeze({ ...step }))),
  });
}

export function createPositionRuntimeState(lifecycle: PositionLifecycle): PositionRuntimeState {
  return freezeState({ lifecycle, pendingExit: null, processedSteps: [] });
}

export function restorePositionRuntimeState(input: PositionRuntimeState): PositionRuntimeState {
  return freezeState(input);
}

/** Bind the exact submission acknowledgement into the durable pending-exit state. */
export function recordExitSubmission(
  input: PositionRuntimeState,
  receipt: SubmissionReceipt | void,
): PositionRuntimeState {
  const state = restorePositionRuntimeState(input);
  if (state.pendingExit === null)
    throw new InvariantViolationError("Exit submission requires a pending exit");
  if (receipt === undefined)
    throw new InvariantViolationError("Exit submission did not return an acknowledgement");
  requireText(receipt.signature, "Submitted transaction signature");
  if (state.pendingExit.submission !== null) {
    if (state.pendingExit.submission.signature !== receipt.signature)
      throw new InvariantViolationError("Pending exit was acknowledged with another signature");
    return state;
  }
  return freezeState({
    ...state,
    pendingExit: Object.freeze({ ...state.pendingExit, submission: Object.freeze({ ...receipt }) }),
  });
}

function completeStep(
  state: PositionRuntimeState,
  step: PositionRuntimeStep,
  lifecycle: PositionLifecycle,
  pendingExit: PendingExit | null,
  action: PositionRuntimeAction,
  emittedEvents: readonly PositionEvent[],
): PositionRuntimeResult {
  const next = freezeState({
    lifecycle,
    pendingExit,
    processedSteps: [
      ...state.processedSteps,
      Object.freeze({ stepId: step.stepId, fingerprint: stepFingerprint(step), action }),
    ],
  });
  return Object.freeze({
    state: next,
    actionId: step.stepId,
    action,
    emittedEvents: Object.freeze([...emittedEvents]),
  });
}

function monitor(state: PositionRuntimeState, step: MonitorPositionStep): PositionRuntimeResult {
  if (state.pendingExit !== null)
    throw new InvariantViolationError("Cannot monitor while an exit awaits reconciliation");
  const position = state.lifecycle.position;
  if (position === null || (position.state !== "open" && position.state !== "partially_closed"))
    throw new InvariantViolationError("Monitoring requires an active position");

  let lifecycle = state.lifecycle;
  const events: PositionEvent[] = [];
  if (
    step.snapshot.executableValueSol !== null &&
    step.snapshot.executableValueSol.gt(position.peakExecutableValueSol)
  ) {
    if (step.preparation === null)
      throw new InvariantViolationError("Peak recording requires deterministic event identity");
    const peak: PositionEvent = Object.freeze({
      type: "position:executable-peak-recorded",
      eventId: step.preparation.peakEventId,
      positionId: position.id,
      aggregateVersion: lifecycle.version + 1n,
      occurredAt: step.snapshot.evaluatedAt,
      executableValueSol: step.snapshot.executableValueSol,
    });
    lifecycle = applyPositionEvent(lifecycle, peak);
    events.push(peak);
  }

  const current = lifecycle.position!;
  const decision = evaluateExit(current, step.snapshot);
  if (decision.action === "none")
    return completeStep(
      state,
      step,
      lifecycle,
      null,
      Object.freeze({ type: "continue_monitoring", decision }),
      events,
    );
  if (step.preparation === null)
    throw new InvariantViolationError("Actionable exit requires execution preparation");
  if (step.preparation.evidence.length === 0)
    throw new InvariantViolationError("Exit execution preparation requires evidence");
  const preparedExecution = Object.freeze({
    ...step.preparation.execution,
    quoteReceivedAt: step.preparation.quoteReceivedAt,
  });
  requireText(preparedExecution.transactionFingerprint, "Prepared transaction fingerprint");
  requireText(preparedExecution.serializedTransactionBase64, "Prepared transaction payload");
  if (preparedExecution.quoteFingerprint !== step.preparation.quoteFingerprint)
    throw new InvariantViolationError("Prepared transaction quote does not match exit preparation");
  if (preparedExecution.lastValidBlockHeight < 0n)
    throw new InvariantViolationError("Prepared transaction block height must be non-negative");
  if (preparedExecution.evidence.length === 0)
    throw new InvariantViolationError("Prepared transaction requires evidence");

  const age = time(step.snapshot.evaluatedAt) - time(step.preparation.quoteReceivedAt);
  const quoteFresh = age >= 0 && age <= 2_000;
  const emergencyRuleIds = decision.results
    .filter(({ ruleId, outcome }) => ruleId.startsWith("EMG-") && outcome === "fail")
    .map(({ ruleId }) => ruleId as string);
  const common = {
    orderId: step.preparation.orderId,
    positionId: current.id,
    positionVersion: current.version,
    currentAmount: current.currentAmount,
    quoteFingerprint: step.preparation.quoteFingerprint,
    evidence: step.preparation.evidence,
    sellRouteValid: step.preparation.sellRouteValid,
    simulationSucceeded: step.preparation.simulationSucceeded,
    createdAt: step.snapshot.evaluatedAt,
  } as const;
  const intent =
    emergencyRuleIds.length > 0
      ? createEmergencyExitIntent({
          ...common,
          emergencyRuleIds,
          quoteFresh,
        })
      : createStandardExitIntent({
          ...common,
          originalAmount: current.originalAmount,
          decision,
          quoteReceivedAt: step.preparation.quoteReceivedAt,
        });
  const requested: PositionEvent = Object.freeze({
    type: "position:exit-requested",
    eventId: step.preparation.exitRequestedEventId,
    positionId: current.id,
    aggregateVersion: lifecycle.version + 1n,
    occurredAt: step.snapshot.evaluatedAt,
  });
  lifecycle = applyPositionEvent(lifecycle, requested);
  events.push(requested);
  const pendingExit = Object.freeze({ intent, decision, submission: null });
  return completeStep(
    state,
    step,
    lifecycle,
    pendingExit,
    Object.freeze({ type: "submit_exit", intent, decision, execution: preparedExecution }),
    events,
  );
}

function reconcile(
  state: PositionRuntimeState,
  step: ReconcilePositionStep,
): PositionRuntimeResult {
  if (state.pendingExit === null)
    throw new InvariantViolationError("Reconciliation requires a pending exit");
  const execution = evaluateSuccessfulExit(state.pendingExit.intent, step.reconciliation);
  if (!execution.reconciled)
    return completeStep(
      state,
      step,
      state.lifecycle,
      state.pendingExit,
      Object.freeze({
        type: "await_reconciliation",
        reason:
          step.reconciliation.onChainError === true
            ? "on_chain_failure"
            : step.reconciliation.transactionConfirmed === true
              ? "balance_mismatch"
              : "pending",
        decision: execution,
      }),
      [],
    );

  const pending = state.pendingExit;
  const target = !execution.requestedAmountSatisfied
    ? "continuation"
    : "standardRuleId" in pending.intent
      ? pending.intent.standardRuleId === "EXT-002"
        ? "first"
        : pending.intent.standardRuleId === "EXT-003"
          ? "second"
          : "full"
      : "full";
  const event: PositionEvent = Object.freeze({
    type: "position:exit-reconciled",
    eventId: step.eventId,
    positionId: pending.intent.positionId,
    aggregateVersion: state.lifecycle.version + 1n,
    occurredAt: step.reconciliation.evaluatedAt,
    target,
    soldAmount: execution.soldAmount!,
    proceedsSol: execution.proceedsSol!,
    reconciledRemainingAmount: execution.remainingAmount!,
  });
  const lifecycle = applyPositionEvent(state.lifecycle, event);
  const action: PositionRuntimeAction = execution.closed
    ? Object.freeze({ type: "position_closed", decision: execution })
    : execution.requiresContinuation
      ? Object.freeze({ type: "refresh_exit", decision: execution })
      : Object.freeze({ type: "exit_reconciled", decision: execution });
  return completeStep(state, step, lifecycle, null, action, [event]);
}

export function processPositionRuntimeStep(
  inputState: PositionRuntimeState,
  step: PositionRuntimeStep,
): PositionRuntimeResult {
  const state = restorePositionRuntimeState(inputState);
  requireText(step.stepId, "Runtime step ID");
  const fingerprint = stepFingerprint(step);
  const duplicate = state.processedSteps.find(({ stepId }) => stepId === step.stepId);
  if (duplicate !== undefined) {
    if (duplicate.fingerprint !== fingerprint)
      throw new InvariantViolationError("Runtime step ID was reused with different content");
    return Object.freeze({
      state,
      actionId: step.stepId,
      action: duplicate.action,
      emittedEvents: Object.freeze([]),
    });
  }
  return step.type === "monitor" ? monitor(state, step) : reconcile(state, step);
}
