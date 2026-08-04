import { createHash } from "node:crypto";

import type { PositionWorkerCheckpoint } from "../ports/repositories.js";
import type { PositionMonitoringFacts, PositionReconciliationFacts } from "../ports/runtime.js";
import { InvariantViolationError } from "../../domain/shared/errors.js";
import {
  asUuid,
  type EvidenceId,
  type PositionId,
  type ProviderId,
  type Timestamp,
} from "../../domain/shared/types.js";
import type {
  PositionObservationInput,
  PositionObservationKind,
} from "../../infrastructure/database/position-observations.js";
import type { PositionRuntimeFactPhase } from "./runtime-fact-aggregation.js";

export type MonitoringFactFragment = Partial<PositionMonitoringFacts>;
export type ReconciliationFactFragment = Partial<PositionReconciliationFacts>;

export interface RuntimeFactFragmentSnapshot {
  readonly kind: PositionObservationKind;
  readonly provider: ProviderId;
  readonly sourceKey: string;
  readonly observedAt: Timestamp;
  readonly phase: PositionRuntimeFactPhase;
  readonly facts: MonitoringFactFragment | ReconciliationFactFragment;
}

export interface PositionObservationSink {
  ingest(input: PositionObservationInput): Promise<{ readonly contentHash: string }>;
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (typeof value === "bigint") return JSON.stringify(value.toString());
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`).join(",")}}`;
  }
  throw new InvariantViolationError("Runtime fact fragment is not serializable");
}

function evidenceId(input: {
  readonly positionId: PositionId;
  readonly revision: bigint;
  readonly snapshot: RuntimeFactFragmentSnapshot;
}): EvidenceId {
  const digest = createHash("sha256")
    .update(input.positionId)
    .update("\0")
    .update(input.revision.toString())
    .update("\0")
    .update(input.snapshot.kind)
    .update("\0")
    .update(input.snapshot.provider)
    .update("\0")
    .update(input.snapshot.sourceKey)
    .update("\0")
    .update(input.snapshot.observedAt)
    .update("\0")
    .update(canonicalize(input.snapshot.facts))
    .digest("hex");
  return asUuid<EvidenceId>(
    `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`,
  );
}

function jsonValue(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(jsonValue);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, jsonValue(item)]),
    );
  return value;
}

/** Persists typed, revision-bound producer output in the immutable observation inbox. */
export class RuntimeFactFragmentProducer {
  public constructor(private readonly sink: PositionObservationSink) {}

  public async produce(
    checkpoint: PositionWorkerCheckpoint,
    snapshot: RuntimeFactFragmentSnapshot,
  ): Promise<EvidenceId> {
    if (snapshot.sourceKey.trim().length === 0)
      throw new InvariantViolationError("Runtime fact producer source key is required");
    if (Object.keys(snapshot.facts).length === 0)
      throw new InvariantViolationError("Runtime fact producer cannot emit an empty fragment");
    const expectedPhase = checkpoint.runtimeState.pendingExit === null ? "monitor" : "reconcile";
    if (snapshot.phase !== expectedPhase)
      throw new InvariantViolationError(
        "Runtime fact producer phase does not match the checkpoint",
      );
    const id = evidenceId({
      positionId: checkpoint.positionId,
      revision: checkpoint.revision,
      snapshot,
    });
    const payload = Object.freeze({
      schemaVersion: 1,
      checkpointRevision: checkpoint.revision.toString(),
      phase: snapshot.phase,
      facts: jsonValue(snapshot.facts) as Readonly<Record<string, unknown>>,
    });
    await this.sink.ingest({
      id,
      positionId: checkpoint.positionId,
      kind: snapshot.kind,
      provider: snapshot.provider,
      sourceKey: snapshot.sourceKey,
      observedAt: snapshot.observedAt,
      payload,
    });
    return id;
  }
}

export interface RuntimeFactSnapshotSource {
  collect(
    checkpoint: PositionWorkerCheckpoint,
    observedAt: Timestamp,
  ): Promise<RuntimeFactFragmentSnapshot>;
}

/** Runs all independent producers for one immutable checkpoint and rejects partial cycles. */
export async function producePositionRuntimeFacts(input: {
  readonly checkpoint: PositionWorkerCheckpoint;
  readonly observedAt: Timestamp;
  readonly sources: readonly RuntimeFactSnapshotSource[];
  readonly producer: RuntimeFactFragmentProducer;
}): Promise<readonly EvidenceId[]> {
  if (input.sources.length === 0)
    throw new InvariantViolationError("Runtime fact production requires at least one source");
  const snapshots = await Promise.all(
    input.sources.map((source) => source.collect(input.checkpoint, input.observedAt)),
  );
  const kinds = new Set(snapshots.map(({ kind }) => kind));
  const required =
    input.checkpoint.runtimeState.pendingExit === null
      ? (["market", "chain", "wallet", "security", "execution"] as const)
      : (["chain", "execution"] as const);
  for (const kind of required)
    if (!kinds.has(kind))
      throw new InvariantViolationError(`Runtime fact production is missing ${kind} evidence`);
  const ids: EvidenceId[] = [];
  for (const snapshot of snapshots)
    ids.push(await input.producer.produce(input.checkpoint, snapshot));
  return Object.freeze(ids);
}
