import { InvariantViolationError } from "../domain/shared/errors.js";
import type { PositionId } from "../domain/shared/types.js";
import {
  processPositionRuntimeStep,
  restorePositionRuntimeState,
  type PositionRuntimeAction,
} from "../application/services/position-monitor.js";
import type {
  PendingPositionAction,
  PositionWorkerCheckpoint,
  PositionWorkerCheckpointRepository,
} from "../application/ports/repositories.js";
import type {
  PositionRuntimeActionDispatcher,
  PositionRuntimeStepSource,
} from "../application/ports/runtime.js";

export interface PositionWorkerDependencies {
  readonly checkpoints: PositionWorkerCheckpointRepository;
  readonly steps: PositionRuntimeStepSource;
  readonly actions: PositionRuntimeActionDispatcher;
}

export interface PositionWorkerCycleResult {
  readonly checkpoint: PositionWorkerCheckpoint;
  readonly action: PositionRuntimeAction;
  readonly recoveredPendingAction: boolean;
}

function requireText(value: string, label: string): void {
  if (value.trim().length === 0) throw new InvariantViolationError(`${label} is required`);
}

function validateCheckpoint(
  checkpoint: PositionWorkerCheckpoint,
  expectedPositionId: PositionId,
): PositionWorkerCheckpoint {
  if (checkpoint.positionId !== expectedPositionId)
    throw new InvariantViolationError("Worker checkpoint belongs to a different position");
  if (checkpoint.revision < 0n)
    throw new InvariantViolationError("Worker checkpoint revision must be non-negative");
  const runtimeState = restorePositionRuntimeState(checkpoint.runtimeState);
  if (runtimeState.lifecycle.position?.id !== expectedPositionId)
    throw new InvariantViolationError("Worker checkpoint runtime targets a different position");
  const pending = checkpoint.pendingAction;
  if (pending !== null) {
    requireText(pending.deliveryId, "Pending delivery ID");
    requireText(pending.actionId, "Pending action ID");
    requireText(pending.stepFingerprint, "Pending step fingerprint");
    const processed = runtimeState.processedSteps.find(({ stepId }) => stepId === pending.actionId);
    if (
      processed === undefined ||
      processed.fingerprint !== pending.stepFingerprint ||
      processed.action.type !== pending.action.type
    )
      throw new InvariantViolationError("Pending action does not match processed runtime step");
  }
  return Object.freeze({ ...checkpoint, runtimeState });
}

function pendingAction(
  positionId: PositionId,
  actionId: string,
  state: PositionWorkerCheckpoint["runtimeState"],
  action: PositionRuntimeAction,
): PendingPositionAction {
  const processed = state.processedSteps.find(({ stepId }) => stepId === actionId);
  if (processed === undefined)
    throw new InvariantViolationError("Runtime result did not retain its processed step");
  return Object.freeze({
    deliveryId: `${positionId}:${actionId}`,
    actionId,
    stepFingerprint: processed.fingerprint,
    action,
  });
}

async function dispatchAndAcknowledge(
  checkpoint: PositionWorkerCheckpoint,
  dependencies: PositionWorkerDependencies,
): Promise<PositionWorkerCheckpoint> {
  const pending = checkpoint.pendingAction;
  if (pending === null)
    throw new InvariantViolationError("Cannot dispatch a checkpoint without a pending action");
  await dependencies.actions.dispatch(pending);
  const acknowledged = await dependencies.checkpoints.acknowledgeAction({
    positionId: checkpoint.positionId,
    expectedRevision: checkpoint.revision,
    deliveryId: pending.deliveryId,
  });
  const validated = validateCheckpoint(acknowledged, checkpoint.positionId);
  if (validated.pendingAction !== null)
    throw new InvariantViolationError("Acknowledged checkpoint still has a pending action");
  return validated;
}

export async function runPositionWorkerCycle(
  positionId: PositionId,
  dependencies: PositionWorkerDependencies,
): Promise<PositionWorkerCycleResult> {
  const loaded = validateCheckpoint(await dependencies.checkpoints.load(positionId), positionId);
  if (loaded.pendingAction !== null) {
    const action = loaded.pendingAction.action;
    const checkpoint = await dispatchAndAcknowledge(loaded, dependencies);
    return Object.freeze({ checkpoint, action, recoveredPendingAction: true });
  }

  const step = await dependencies.steps.nextStep(loaded);
  const result = processPositionRuntimeStep(loaded.runtimeState, step);
  if (loaded.runtimeState.processedSteps.some(({ stepId }) => stepId === result.actionId))
    return Object.freeze({
      checkpoint: loaded,
      action: result.action,
      recoveredPendingAction: false,
    });
  const pending = pendingAction(positionId, result.actionId, result.state, result.action);
  const saved = validateCheckpoint(
    await dependencies.checkpoints.saveTransition({
      positionId,
      expectedRevision: loaded.revision,
      runtimeState: result.state,
      pendingAction: pending,
      emittedEvents: result.emittedEvents,
    }),
    positionId,
  );
  if (saved.pendingAction?.deliveryId !== pending.deliveryId)
    throw new InvariantViolationError("Saved checkpoint did not retain the pending action");
  const checkpoint = await dispatchAndAcknowledge(saved, dependencies);
  return Object.freeze({ checkpoint, action: result.action, recoveredPendingAction: false });
}
