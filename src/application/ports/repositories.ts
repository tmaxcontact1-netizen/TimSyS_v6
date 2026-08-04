import type { PositionRuntimeAction, PositionRuntimeState } from "../services/position-monitor.js";
import type { PositionEvent } from "../../domain/trading/position.js";
import type { PositionId } from "../../domain/shared/types.js";

export interface PendingPositionAction {
  readonly deliveryId: string;
  readonly actionId: string;
  readonly stepFingerprint: string;
  readonly action: PositionRuntimeAction;
}

export interface PositionWorkerCheckpoint {
  readonly positionId: PositionId;
  readonly revision: bigint;
  readonly runtimeState: PositionRuntimeState;
  readonly pendingAction: PendingPositionAction | null;
}

export interface SavePositionWorkerTransition {
  readonly positionId: PositionId;
  readonly expectedRevision: bigint;
  readonly runtimeState: PositionRuntimeState;
  readonly pendingAction: PendingPositionAction;
  readonly emittedEvents: readonly PositionEvent[];
}

export interface AcknowledgePositionAction {
  readonly positionId: PositionId;
  readonly expectedRevision: bigint;
  readonly deliveryId: string;
}

/**
 * Implementations must compare-and-swap on expectedRevision. Saving runtime state,
 * emitted events, the pending action, and the durable follow-up job is one transaction.
 */
export interface PositionWorkerCheckpointRepository {
  load(positionId: PositionId): Promise<PositionWorkerCheckpoint>;
  saveTransition(input: SavePositionWorkerTransition): Promise<PositionWorkerCheckpoint>;
  acknowledgeAction(input: AcknowledgePositionAction): Promise<PositionWorkerCheckpoint>;
}
