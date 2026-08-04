import { Decimal } from "decimal.js";

import { InvariantViolationError } from "../shared/errors.js";
import { createStateMachine } from "../shared/state-machine.js";
import {
  asDecimal,
  asRawAmount,
  type DecimalValue,
  type AuditEventId,
  type OrderId,
  type PositionId,
  type RawAmount,
  type Timestamp,
  type TokenId,
} from "../shared/types.js";

export type PositionState =
  | "pending_entry"
  | "open"
  | "partially_closed"
  | "exit_pending"
  | "closed"
  | "reconciliation_locked";

export const positionStateMachine = createStateMachine<PositionState>({
  pending_entry: ["open", "reconciliation_locked"],
  open: ["exit_pending", "reconciliation_locked"],
  partially_closed: ["exit_pending", "reconciliation_locked"],
  exit_pending: ["partially_closed", "closed", "reconciliation_locked"],
  closed: [],
  reconciliation_locked: ["open", "partially_closed", "closed"],
});

export interface PositionLot {
  readonly sourceOrderId: OrderId;
  readonly acquiredAmount: RawAmount;
  readonly currentAmount: RawAmount;
  readonly costBasisSol: DecimalValue;
  readonly openedAt: Timestamp;
  readonly closedAt: Timestamp | null;
}

export interface Position {
  readonly id: PositionId;
  readonly tokenId: TokenId;
  readonly entryOrderId: OrderId;
  readonly state: PositionState;
  readonly originalAmount: RawAmount;
  readonly currentAmount: RawAmount;
  readonly originalCostBasisSol: DecimalValue;
  readonly remainingCostBasisSol: DecimalValue;
  readonly realisedPnlSol: DecimalValue;
  readonly peakExecutableValueSol: DecimalValue;
  readonly firstTargetSatisfied: boolean;
  readonly secondTargetSatisfied: boolean;
  readonly lots: readonly PositionLot[];
  readonly openedAt: Timestamp;
  readonly closedAt: Timestamp | null;
  readonly updatedAt: Timestamp;
  readonly version: bigint;
}

export interface ExitReconciliation {
  readonly soldAmount: RawAmount;
  readonly proceedsSol: DecimalValue;
  readonly reconciledRemainingAmount: RawAmount;
  readonly confirmedAt: Timestamp;
}

interface PositionEventBase {
  readonly eventId: AuditEventId;
  readonly positionId: PositionId;
  readonly aggregateVersion: bigint;
  readonly occurredAt: Timestamp;
}

export interface PositionOpenedEvent extends PositionEventBase {
  readonly type: "position:opened";
  readonly tokenId: TokenId;
  readonly entryOrderId: OrderId;
  readonly acquiredAmount: RawAmount;
  readonly costBasisSol: DecimalValue;
}

export interface PositionExecutablePeakRecordedEvent extends PositionEventBase {
  readonly type: "position:executable-peak-recorded";
  readonly executableValueSol: DecimalValue;
}

export interface PositionExitRequestedEvent extends PositionEventBase {
  readonly type: "position:exit-requested";
}

export interface PositionExitReconciledEvent extends PositionEventBase {
  readonly type: "position:exit-reconciled";
  readonly target: "first" | "second" | "full";
  readonly soldAmount: RawAmount;
  readonly proceedsSol: DecimalValue;
  readonly reconciledRemainingAmount: RawAmount;
}

export type PositionEvent =
  | PositionOpenedEvent
  | PositionExecutablePeakRecordedEvent
  | PositionExitRequestedEvent
  | PositionExitReconciledEvent;

export interface AppliedPositionEvent {
  readonly eventId: AuditEventId;
  readonly fingerprint: string;
}

export interface PositionLifecycle {
  readonly position: Position | null;
  readonly appliedEvents: readonly AppliedPositionEvent[];
  readonly lastEventAt: Timestamp | null;
  readonly version: bigint;
}

export function createEmptyPositionLifecycle(): PositionLifecycle {
  return Object.freeze({
    position: null,
    appliedEvents: Object.freeze([]),
    lastEventAt: null,
    version: -1n,
  });
}

export function restorePositionLifecycle(input: PositionLifecycle): PositionLifecycle {
  if (input.version < -1n)
    throw new InvariantViolationError("Position lifecycle version is invalid");
  if (
    new Set(input.appliedEvents.map(({ eventId }) => eventId)).size !== input.appliedEvents.length
  )
    throw new InvariantViolationError("Position lifecycle event IDs must be unique");
  if (input.position === null) {
    if (input.version !== -1n || input.lastEventAt !== null || input.appliedEvents.length !== 0)
      throw new InvariantViolationError("Empty position lifecycle cannot contain event state");
  } else {
    const restored = restorePosition(input.position);
    if (restored.version !== input.version)
      throw new InvariantViolationError("Position lifecycle version must match position version");
    if (input.lastEventAt === null || time(input.lastEventAt) !== time(restored.updatedAt))
      throw new InvariantViolationError("Position lifecycle event time must match position update");
    if (BigInt(input.appliedEvents.length - 1) !== input.version)
      throw new InvariantViolationError("Position lifecycle event count must match version");
  }
  return Object.freeze({
    ...input,
    position: input.position === null ? null : restorePosition(input.position),
    appliedEvents: Object.freeze(input.appliedEvents.map((event) => Object.freeze({ ...event }))),
  });
}

function positionEventFingerprint(event: PositionEvent): string {
  const common = [
    event.type,
    event.eventId,
    event.positionId,
    event.aggregateVersion.toString(),
    event.occurredAt,
  ];
  switch (event.type) {
    case "position:opened":
      return [
        ...common,
        event.tokenId,
        event.entryOrderId,
        event.acquiredAmount.toString(),
        event.costBasisSol.toString(),
      ].join("|");
    case "position:executable-peak-recorded":
      return [...common, event.executableValueSol.toString()].join("|");
    case "position:exit-requested":
      return common.join("|");
    case "position:exit-reconciled":
      return [
        ...common,
        event.target,
        event.soldAmount.toString(),
        event.proceedsSol.toString(),
        event.reconciledRemainingAmount.toString(),
      ].join("|");
  }
}

export function applyPositionEvent(
  lifecycle: PositionLifecycle,
  event: PositionEvent,
): PositionLifecycle {
  const current = restorePositionLifecycle(lifecycle);
  const fingerprint = positionEventFingerprint(event);
  const duplicate = current.appliedEvents.find(({ eventId }) => eventId === event.eventId);
  if (duplicate !== undefined) {
    if (duplicate.fingerprint !== fingerprint)
      throw new InvariantViolationError("Position event ID was reused with different content");
    return current;
  }
  if (event.aggregateVersion !== current.version + 1n)
    throw new InvariantViolationError("Position event version is not the next aggregate version");
  if (current.lastEventAt !== null && time(event.occurredAt) < time(current.lastEventAt))
    throw new InvariantViolationError("Position event time cannot move backwards");
  if (current.position !== null && event.positionId !== current.position.id)
    throw new InvariantViolationError("Position event targets a different aggregate");

  let position: Position;
  switch (event.type) {
    case "position:opened":
      if (current.position !== null || event.aggregateVersion !== 0n)
        throw new InvariantViolationError("Position opened event must start an empty lifecycle");
      position = createReconciledPosition({
        id: event.positionId,
        tokenId: event.tokenId,
        entryOrderId: event.entryOrderId,
        acquiredAmount: event.acquiredAmount,
        costBasisSol: event.costBasisSol,
        reconciledAt: event.occurredAt,
      });
      break;
    case "position:executable-peak-recorded":
      if (current.position === null)
        throw new InvariantViolationError("Position event requires an opened position");
      position = recordExecutablePeak(current.position, event.executableValueSol, event.occurredAt);
      break;
    case "position:exit-requested":
      if (current.position === null)
        throw new InvariantViolationError("Position event requires an opened position");
      position = markExitPending(current.position, event.occurredAt);
      break;
    case "position:exit-reconciled":
      if (current.position === null)
        throw new InvariantViolationError("Position event requires an opened position");
      position = reconcileExit(
        current.position,
        {
          soldAmount: event.soldAmount,
          proceedsSol: event.proceedsSol,
          reconciledRemainingAmount: event.reconciledRemainingAmount,
          confirmedAt: event.occurredAt,
        },
        event.target,
      );
      break;
  }
  if (position.version !== event.aggregateVersion)
    throw new InvariantViolationError("Position mutation version does not match event version");
  return restorePositionLifecycle({
    position,
    appliedEvents: Object.freeze([
      ...current.appliedEvents,
      Object.freeze({ eventId: event.eventId, fingerprint }),
    ]),
    lastEventAt: event.occurredAt,
    version: event.aggregateVersion,
  });
}

export function replayPositionEvents(events: readonly PositionEvent[]): PositionLifecycle {
  return events.reduce(applyPositionEvent, createEmptyPositionLifecycle());
}

const time = (value: Timestamp): number => new Date(value).getTime();

export function restorePosition(input: Position): Position {
  if (input.originalAmount <= 0n)
    throw new InvariantViolationError("Position amount must be positive");
  if (input.currentAmount > input.originalAmount)
    throw new InvariantViolationError("Position current amount cannot exceed original amount");
  if (input.originalCostBasisSol.lte(0) || input.remainingCostBasisSol.isNegative())
    throw new InvariantViolationError("Position cost basis is invalid");
  if (input.remainingCostBasisSol.gt(input.originalCostBasisSol))
    throw new InvariantViolationError("Remaining cost basis cannot exceed original cost basis");
  if (input.peakExecutableValueSol.isNegative())
    throw new InvariantViolationError("Executable peak must be non-negative");
  if (input.version < 0n)
    throw new InvariantViolationError("Position version must be non-negative");
  if (input.lots.length === 0)
    throw new InvariantViolationError("Position requires at least one lot");
  const lotCurrent = input.lots.reduce((total, lot) => total + lot.currentAmount, 0n);
  const lotOriginal = input.lots.reduce((total, lot) => total + lot.acquiredAmount, 0n);
  if (lotCurrent !== input.currentAmount || lotOriginal !== input.originalAmount)
    throw new InvariantViolationError("Position lot quantities must match aggregate quantities");
  if (input.secondTargetSatisfied && !input.firstTargetSatisfied)
    throw new InvariantViolationError("Second target requires first target satisfaction");
  const closed = input.state === "closed";
  if (closed !== (input.currentAmount === 0n && input.closedAt !== null))
    throw new InvariantViolationError("Closed state requires zero balance and closure timestamp");
  if (!closed && input.closedAt !== null)
    throw new InvariantViolationError("Active position cannot have a closure timestamp");
  if (time(input.updatedAt) < time(input.openedAt))
    throw new InvariantViolationError("Position update cannot precede opening");
  if (input.closedAt !== null && time(input.closedAt) < time(input.openedAt))
    throw new InvariantViolationError("Position closure cannot precede opening");
  return Object.freeze({
    ...input,
    lots: Object.freeze(input.lots.map((lot) => Object.freeze({ ...lot }))),
  });
}

export function createReconciledPosition(input: {
  readonly id: PositionId;
  readonly tokenId: TokenId;
  readonly entryOrderId: OrderId;
  readonly acquiredAmount: RawAmount;
  readonly costBasisSol: DecimalValue;
  readonly reconciledAt: Timestamp;
}): Position {
  if (input.acquiredAmount <= 0n)
    throw new InvariantViolationError("Position amount must be positive");
  if (input.costBasisSol.lte(0))
    throw new InvariantViolationError("Position cost basis must be positive");
  const lot = Object.freeze({
    sourceOrderId: input.entryOrderId,
    acquiredAmount: input.acquiredAmount,
    currentAmount: input.acquiredAmount,
    costBasisSol: input.costBasisSol,
    openedAt: input.reconciledAt,
    closedAt: null,
  });
  return restorePosition({
    id: input.id,
    tokenId: input.tokenId,
    entryOrderId: input.entryOrderId,
    state: "open",
    originalAmount: input.acquiredAmount,
    currentAmount: input.acquiredAmount,
    originalCostBasisSol: input.costBasisSol,
    remainingCostBasisSol: input.costBasisSol,
    realisedPnlSol: asDecimal(0),
    peakExecutableValueSol: input.costBasisSol,
    firstTargetSatisfied: false,
    secondTargetSatisfied: false,
    lots: Object.freeze([lot]),
    openedAt: input.reconciledAt,
    closedAt: null,
    updatedAt: input.reconciledAt,
    version: 0n,
  });
}

export function recordExecutablePeak(
  position: Position,
  value: DecimalValue,
  at: Timestamp,
): Position {
  if (position.state === "closed")
    throw new InvariantViolationError("Closed position cannot be updated");
  if (value.isNegative())
    throw new InvariantViolationError("Executable value must be non-negative");
  if (time(at) < time(position.updatedAt))
    throw new InvariantViolationError("Position time cannot move backwards");
  const peak = Decimal.max(position.peakExecutableValueSol, value);
  return restorePosition({
    ...position,
    peakExecutableValueSol: asDecimal(peak),
    updatedAt: at,
    version: position.version + 1n,
  });
}

export function markExitPending(position: Position, at: Timestamp): Position {
  if (time(at) < time(position.updatedAt))
    throw new InvariantViolationError("Position time cannot move backwards");
  positionStateMachine.transition(position.state, "exit_pending");
  return restorePosition({
    ...position,
    state: "exit_pending",
    updatedAt: at,
    version: position.version + 1n,
  });
}

export function reconcileExit(
  position: Position,
  input: ExitReconciliation,
  target: "first" | "second" | "full",
): Position {
  if (position.state !== "exit_pending")
    throw new InvariantViolationError("Exit reconciliation requires exit_pending state");
  if (input.soldAmount <= 0n || input.soldAmount > position.currentAmount)
    throw new InvariantViolationError("Reconciled sold amount is invalid");
  if (input.proceedsSol.isNegative())
    throw new InvariantViolationError("Exit proceeds must be non-negative");
  if (input.reconciledRemainingAmount !== position.currentAmount - input.soldAmount)
    throw new InvariantViolationError("Reconciled remaining amount does not match balance change");
  if (time(input.confirmedAt) < time(position.updatedAt))
    throw new InvariantViolationError("Position time cannot move backwards");

  const allocatedCost = position.remainingCostBasisSol
    .mul(input.soldAmount.toString())
    .div(position.currentAmount.toString());
  const remainingCost = position.remainingCostBasisSol.minus(allocatedCost);
  const realised = position.realisedPnlSol.plus(input.proceedsSol).minus(allocatedCost);
  const remaining = input.reconciledRemainingAmount;
  const closed = remaining === 0n;
  if (target === "full" && !closed)
    throw new InvariantViolationError("Full exit cannot close without reconciled zero balance");

  const lots = Object.freeze(
    position.lots.map((lot) =>
      Object.freeze({
        ...lot,
        currentAmount: remaining,
        closedAt: closed ? input.confirmedAt : null,
      }),
    ),
  );
  return restorePosition({
    ...position,
    state: closed ? "closed" : "partially_closed",
    currentAmount: asRawAmount(remaining),
    remainingCostBasisSol: asDecimal(remainingCost),
    realisedPnlSol: asDecimal(realised),
    firstTargetSatisfied:
      position.firstTargetSatisfied || target === "first" || target === "second",
    secondTargetSatisfied: position.secondTargetSatisfied || target === "second",
    lots,
    closedAt: closed ? input.confirmedAt : null,
    updatedAt: input.confirmedAt,
    version: position.version + 1n,
  });
}
