import type { PendingPositionAction, PositionWorkerCheckpoint } from "./repositories.js";
import type { PositionRuntimeStep } from "../services/position-monitor.js";

export interface PositionRuntimeStepSource {
  nextStep(checkpoint: PositionWorkerCheckpoint): Promise<PositionRuntimeStep>;
}

/** Dispatch must be idempotent on deliveryId. */
export interface PositionRuntimeActionDispatcher {
  dispatch(pending: PendingPositionAction): Promise<void>;
}
