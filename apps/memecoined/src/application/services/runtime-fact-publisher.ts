import type { PositionWorkerCheckpointRepository } from "../ports/repositories.js";
import type { PositionMonitoringFacts, PositionReconciliationFacts } from "../ports/runtime.js";
import type { EvidenceId, PositionId, Timestamp } from "../../domain/shared/types.js";
import {
  aggregatePositionRuntimeFacts,
  type RuntimeFactObservation,
} from "./runtime-fact-aggregation.js";
import {
  producePositionRuntimeFacts,
  type RuntimeFactFragmentProducer,
  type RuntimeFactSnapshotSource,
} from "./runtime-fact-producers.js";
import { InvariantViolationError } from "../../domain/shared/errors.js";

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

export interface LivePositionRuntimeFactCycleDependencies extends PositionRuntimeFactPublisherDependencies {
  readonly producer: RuntimeFactFragmentProducer;
  readonly monitoringSources: readonly RuntimeFactSnapshotSource[];
  readonly reconciliationSources: readonly RuntimeFactSnapshotSource[];
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

/** Produces a complete authority set and publishes only the same durable checkpoint revision. */
export async function runLivePositionRuntimeFactCycle(
  positionId: PositionId,
  dependencies: LivePositionRuntimeFactCycleDependencies,
): Promise<PositionRuntimeFactPublisherResult> {
  const checkpoint = await dependencies.checkpoints.load(positionId);
  const observedAt = dependencies.now();
  const sources =
    checkpoint.runtimeState.pendingExit === null
      ? dependencies.monitoringSources
      : dependencies.reconciliationSources;
  await producePositionRuntimeFacts({
    checkpoint,
    observedAt,
    sources,
    producer: dependencies.producer,
  });
  const published = await runPositionRuntimeFactPublisherCycle(positionId, dependencies);
  if (published.checkpointRevision !== checkpoint.revision)
    throw new InvariantViolationError(
      "Runtime checkpoint changed between live fact production and publication",
    );
  return published;
}
