import type { PositionWorkerCheckpointRepository } from "../ports/repositories.js";
import type { PositionMonitoringFacts, PositionReconciliationFacts } from "../ports/runtime.js";
import type { EvidenceId, PositionId, Timestamp } from "../../domain/shared/types.js";
import {
  aggregatePositionRuntimeFacts,
  type RuntimeFactObservation,
} from "./runtime-fact-aggregation.js";

export interface RuntimeFactObservationSource {
  listRuntimeFactObservations(input: {
    readonly positionId: PositionId;
    readonly evaluatedAt: Timestamp;
    readonly limit?: number;
  }): Promise<readonly RuntimeFactObservation[]>;
}

export interface RuntimeFactPublicationPort {
  publish(input: {
    readonly id: EvidenceId;
    readonly checkpoint: Awaited<ReturnType<PositionWorkerCheckpointRepository["load"]>>;
    readonly phase: "monitor" | "reconcile";
    readonly facts: PositionMonitoringFacts | PositionReconciliationFacts;
    readonly observationIds: readonly EvidenceId[];
  }): Promise<void>;
}

export interface PositionRuntimeFactPublisherDependencies {
  readonly checkpoints: PositionWorkerCheckpointRepository;
  readonly observations: RuntimeFactObservationSource;
  readonly publications: RuntimeFactPublicationPort;
  readonly now: () => Timestamp;
  readonly observationLimit?: number;
}

export interface PositionRuntimeFactPublisherResult {
  readonly positionId: PositionId;
  readonly checkpointRevision: bigint;
  readonly phase: "monitor" | "reconcile";
  readonly publicationId: EvidenceId;
  readonly observationIds: readonly EvidenceId[];
}

/** Creates exactly one idempotent fact publication for the current durable checkpoint. */
export async function runPositionRuntimeFactPublisherCycle(
  positionId: PositionId,
  dependencies: PositionRuntimeFactPublisherDependencies,
): Promise<PositionRuntimeFactPublisherResult> {
  const checkpoint = await dependencies.checkpoints.load(positionId);
  const phase = checkpoint.runtimeState.pendingExit === null ? "monitor" : "reconcile";
  const evaluatedAt = dependencies.now();
  const observations = await dependencies.observations.listRuntimeFactObservations({
    positionId,
    evaluatedAt,
    ...(dependencies.observationLimit === undefined
      ? {}
      : { limit: dependencies.observationLimit }),
  });
  const aggregate = aggregatePositionRuntimeFacts({
    checkpoint,
    phase,
    evaluatedAt,
    observations,
  });
  await dependencies.publications.publish({
    id: aggregate.id,
    checkpoint,
    phase,
    facts: aggregate.facts,
    observationIds: aggregate.observationIds,
  });
  return Object.freeze({
    positionId,
    checkpointRevision: checkpoint.revision,
    phase,
    publicationId: aggregate.id,
    observationIds: aggregate.observationIds,
  });
}
