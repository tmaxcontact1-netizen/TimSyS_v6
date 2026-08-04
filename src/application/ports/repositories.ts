import type { PositionRuntimeAction, PositionRuntimeState } from "../services/position-monitor.js";
import type { PositionEvent } from "../../domain/trading/position.js";
import type { PositionId } from "../../domain/shared/types.js";
import type { PositionRuntimeAuthorityBaseline } from "./runtime-authority-inputs.js";
import type { DiscoveredCandidateInput, Candidate } from "../../domain/candidate/model.js";
import type { CandidateEvaluationDecision } from "../../domain/candidate/evaluator.js";
import type { PositionSizingDecision } from "../../domain/portfolio/sizing.js";
import type { CircuitBreakerDecision } from "../../domain/portfolio/breakers.js";
import type { CandidateId, SignalId, Timestamp } from "../../domain/shared/types.js";
import type { OrderId } from "../../domain/shared/types.js";
import type { EntryGateDecision, EntryGateSnapshot } from "../../domain/trading/quote.js";
import type { ConstructedSwap } from "./swap.js";

export interface InitializePositionWorkerCheckpoint {
  readonly positionId: PositionId;
  readonly runtimeState: PositionRuntimeState;
  readonly authorityBaseline: PositionRuntimeAuthorityBaseline;
}

export interface PositionOpeningRepository {
  initialize(input: InitializePositionWorkerCheckpoint): Promise<PositionWorkerCheckpoint>;
}

export interface CandidateDiscoveryResult {
  readonly candidate: Candidate;
  readonly candidateCreated: boolean;
  readonly sourceAdded: boolean;
}

/** Candidate identity, provenance, and evaluation scheduling are committed atomically. */
export interface CandidateDiscoveryRepository {
  recordDiscovery(input: DiscoveredCandidateInput): Promise<CandidateDiscoveryResult>;
}

export interface PersistCandidateEvaluation {
  readonly candidateId: CandidateId;
  readonly evaluationRunId: string;
  readonly signalId: SignalId | null;
  readonly evaluatedAt: Timestamp;
  readonly decision: CandidateEvaluationDecision;
}

/** Evaluation rows, terminal candidate state, signal/rejection, and job completion are atomic. */
export interface CandidateEvaluationRepository {
  saveEvaluation(input: PersistCandidateEvaluation): Promise<void>;
}

export interface PersistRiskDecision {
  readonly signalId: SignalId;
  readonly riskRunId: string;
  readonly evaluatedAt: Timestamp;
  readonly sizing: PositionSizingDecision;
  readonly breakers: CircuitBreakerDecision;
}

/** Risk evidence, signal state, entry plan, and follow-up job are committed atomically. */
export interface RiskDecisionRepository {
  saveRiskDecision(input: PersistRiskDecision): Promise<void>;
}

export interface PersistEntryPreparation {
  readonly signalId: SignalId;
  readonly orderId: OrderId;
  readonly evaluatedAt: Timestamp;
  readonly snapshot: EntryGateSnapshot;
  readonly decision: EntryGateDecision;
  readonly constructedSwap: ConstructedSwap | null;
}

export interface EntryPreparationRepository {
  saveEntryPreparation(input: PersistEntryPreparation): Promise<void>;
}

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
  readonly runtimeState: PositionRuntimeState;
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
