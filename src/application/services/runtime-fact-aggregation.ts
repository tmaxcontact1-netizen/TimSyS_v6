import { createHash } from "node:crypto";

import type { PositionWorkerCheckpoint } from "../ports/repositories.js";
import type { PositionMonitoringFacts, PositionReconciliationFacts } from "../ports/runtime.js";
import { InvariantViolationError } from "../../domain/shared/errors.js";
import {
  asUuid,
  type EvidenceId,
  type PositionId,
  type Timestamp,
} from "../../domain/shared/types.js";

export type PositionRuntimeFactPhase = "monitor" | "reconcile";

export interface RuntimeFactObservation {
  readonly id: EvidenceId;
  readonly positionId: PositionId;
  readonly observedAt: Timestamp;
  readonly payload: unknown;
}

export interface AggregatedPositionRuntimeFacts {
  readonly id: EvidenceId;
  readonly phase: PositionRuntimeFactPhase;
  readonly facts: PositionMonitoringFacts | PositionReconciliationFacts;
  readonly observationIds: readonly EvidenceId[];
}

function record(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new InvariantViolationError(`${label} must be an object`);
  return value as Readonly<Record<string, unknown>>;
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`).join(",")}}`;
  }
  throw new InvariantViolationError("Runtime fact fragment is not JSON-compatible");
}

function deterministicId(input: {
  readonly positionId: PositionId;
  readonly revision: bigint;
  readonly phase: PositionRuntimeFactPhase;
  readonly facts: Readonly<Record<string, unknown>>;
}): EvidenceId {
  const hex = createHash("sha256")
    .update(input.positionId)
    .update("\0")
    .update(input.revision.toString())
    .update("\0")
    .update(input.phase)
    .update("\0")
    .update(canonicalize(input.facts))
    .digest("hex");
  return asUuid<EvidenceId>(
    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`,
  );
}

function mergeEvidence(previous: unknown, current: unknown): readonly unknown[] {
  if (!Array.isArray(current) || (previous !== undefined && !Array.isArray(previous)))
    throw new InvariantViolationError("Runtime fact evidence must be an array");
  const merged = previous === undefined ? [] : [...(previous as readonly unknown[])];
  const identities = new Set(merged.map(canonicalize));
  for (const item of current) {
    const identity = canonicalize(item);
    if (!identities.has(identity)) {
      merged.push(item);
      identities.add(identity);
    }
  }
  return Object.freeze(merged);
}

/** Merges only fragments explicitly bound to the current checkpoint revision. */
export function aggregatePositionRuntimeFacts(input: {
  readonly checkpoint: PositionWorkerCheckpoint;
  readonly phase: PositionRuntimeFactPhase;
  readonly evaluatedAt: Timestamp;
  readonly observations: readonly RuntimeFactObservation[];
}): AggregatedPositionRuntimeFacts {
  const ordered = [...input.observations].sort((left, right) =>
    left.observedAt === right.observedAt
      ? left.id.localeCompare(right.id)
      : left.observedAt.localeCompare(right.observedAt),
  );
  const seen = new Set<EvidenceId>();
  const fields = new Map<string, { value: unknown; observedAt: Timestamp }>();
  const used: EvidenceId[] = [];
  for (const observation of ordered) {
    if (observation.positionId !== input.checkpoint.positionId)
      throw new InvariantViolationError("Runtime fact observation targets a different position");
    if (observation.observedAt > input.evaluatedAt)
      throw new InvariantViolationError("Runtime fact observation is from the future");
    if (seen.has(observation.id))
      throw new InvariantViolationError("Runtime fact observations must be unique");
    seen.add(observation.id);
    const envelope = record(observation.payload, "Runtime fact observation payload");
    const keys = Object.keys(envelope).sort();
    if (keys.join(",") !== "checkpointRevision,facts,phase,schemaVersion")
      throw new InvariantViolationError("Runtime fact observation envelope is malformed");
    if (envelope.schemaVersion !== 1) continue;
    if (envelope.phase !== input.phase) continue;
    if (envelope.checkpointRevision !== input.checkpoint.revision.toString()) continue;
    const fragment = record(envelope.facts, "Runtime fact fragment");
    if (Object.keys(fragment).length === 0)
      throw new InvariantViolationError("Runtime fact fragment cannot be empty");
    for (const [key, value] of Object.entries(fragment)) {
      const previous = fields.get(key);
      if (key === "evidence") {
        fields.set(key, {
          value: mergeEvidence(previous?.value, value),
          observedAt: observation.observedAt,
        });
        continue;
      }
      if (
        previous?.observedAt === observation.observedAt &&
        canonicalize(previous.value) !== canonicalize(value)
      )
        throw new InvariantViolationError(
          `Runtime fact field ${key} has contradictory simultaneous observations`,
        );
      fields.set(key, { value, observedAt: observation.observedAt });
    }
    used.push(observation.id);
  }
  if (used.length === 0)
    throw new InvariantViolationError("No observations match the checkpoint fact publication");
  const facts = Object.freeze(
    Object.fromEntries([...fields.entries()].map(([key, { value }]) => [key, value])),
  );
  return Object.freeze({
    id: deterministicId({
      positionId: input.checkpoint.positionId,
      revision: input.checkpoint.revision,
      phase: input.phase,
      facts,
    }),
    phase: input.phase,
    facts: facts as unknown as PositionMonitoringFacts | PositionReconciliationFacts,
    observationIds: Object.freeze(used),
  });
}
