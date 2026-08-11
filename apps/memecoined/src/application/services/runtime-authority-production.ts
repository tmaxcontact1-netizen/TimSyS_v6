import { createHash } from "node:crypto";

import type { PositionWorkerCheckpoint } from "../ports/repositories.js";
import { InvariantViolationError } from "../../domain/shared/errors.js";
import {
  asUuid,
  type EvidenceId,
  type PositionId,
  type ProviderId,
  type Timestamp,
} from "../../domain/shared/types.js";
import type { PositionRuntimeAuthoritySnapshotInput } from "../../infrastructure/database/runtime-authority.js";
import type { TokenSecuritySnapshot } from "../../domain/token/security.js";
import {
  deriveMonitoringExecutionAuthority,
  deriveReconciliationExecutionAuthority,
  type ExecutionRuntimeContext,
  type MonitoringRuntimeHistory,
} from "./execution-runtime-authority.js";
import { deriveSecurityRuntimeAuthority } from "./security-runtime-authority.js";
import {
  deriveWalletRuntimeAuthority,
  type WalletRuntimeAuthorityInput,
} from "./wallet-runtime-authority.js";

export interface RuntimeAuthoritySnapshotSink {
  recordSnapshot(input: PositionRuntimeAuthoritySnapshotInput): Promise<void>;
}

export interface MonitoringRuntimeAuthorityInputSource {
  load(input: {
    readonly checkpoint: PositionWorkerCheckpoint;
    readonly observedAt: Timestamp;
  }): Promise<{
    readonly context: ExecutionRuntimeContext;
    readonly history: MonitoringRuntimeHistory;
    readonly wallets: WalletRuntimeAuthorityInput;
    readonly entrySecurity: TokenSecuritySnapshot;
    readonly currentSecurity: TokenSecuritySnapshot;
  }>;
}

export interface ReconciliationRuntimeAuthorityInputSource {
  load(input: {
    readonly checkpoint: PositionWorkerCheckpoint;
    readonly observedAt: Timestamp;
  }): Promise<Pick<ExecutionRuntimeContext, "wallet" | "tokenMint">>;
}

function snapshotId(
  positionId: PositionId,
  revision: bigint,
  phase: "monitor" | "reconcile",
  kind: "wallet" | "security" | "execution",
): EvidenceId {
  const digest = createHash("sha256")
    .update([positionId, revision.toString(), phase, kind, "authority-v1"].join("\0"))
    .digest("hex");
  return asUuid<EvidenceId>(
    `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`,
  );
}

function json(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(json);
  if (value !== null && typeof value === "object") {
    const serializable = value as { readonly toJSON?: () => unknown };
    if (typeof serializable.toJSON === "function") return json(serializable.toJSON());
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, json(item)]),
    );
  }
  return value;
}

function record(
  sink: RuntimeAuthoritySnapshotSink,
  checkpoint: PositionWorkerCheckpoint,
  observedAt: Timestamp,
  phase: "monitor" | "reconcile",
  kind: "wallet" | "security" | "execution",
  facts: object,
): Promise<void> {
  const provider: ProviderId = "solana_rpc";
  return sink.recordSnapshot({
    id: snapshotId(checkpoint.positionId, checkpoint.revision, phase, kind),
    positionId: checkpoint.positionId,
    checkpointRevision: checkpoint.revision,
    phase,
    kind,
    provider,
    sourceKey: `${kind}:${checkpoint.positionId}:${checkpoint.revision.toString()}:${phase}`,
    observedAt,
    facts: json(facts) as Readonly<Record<string, unknown>>,
  });
}

/** Derives all mandatory monitoring authority before making any immutable write. */
export async function produceMonitoringRuntimeAuthority(input: {
  readonly checkpoint: PositionWorkerCheckpoint;
  readonly observedAt: Timestamp;
  readonly source: MonitoringRuntimeAuthorityInputSource;
  readonly sink: RuntimeAuthoritySnapshotSink;
}): Promise<void> {
  if (input.checkpoint.runtimeState.pendingExit !== null)
    throw new InvariantViolationError("Monitoring authority cannot target reconciliation state");
  const loaded = await input.source.load(input);
  const wallet = deriveWalletRuntimeAuthority(loaded.wallets);
  const security = deriveSecurityRuntimeAuthority({
    entry: loaded.entrySecurity,
    current: loaded.currentSecurity,
  });
  const execution = deriveMonitoringExecutionAuthority({
    checkpoint: input.checkpoint,
    context: loaded.context,
    observedAt: input.observedAt,
    history: loaded.history,
  });
  await Promise.all([
    record(input.sink, input.checkpoint, input.observedAt, "monitor", "wallet", wallet),
    record(input.sink, input.checkpoint, input.observedAt, "monitor", "security", security),
    record(input.sink, input.checkpoint, input.observedAt, "monitor", "execution", execution),
  ]);
}

export async function produceReconciliationRuntimeAuthority(input: {
  readonly checkpoint: PositionWorkerCheckpoint;
  readonly observedAt: Timestamp;
  readonly source: ReconciliationRuntimeAuthorityInputSource;
  readonly sink: RuntimeAuthoritySnapshotSink;
}): Promise<void> {
  if (input.checkpoint.runtimeState.pendingExit === null)
    throw new InvariantViolationError("Reconciliation authority requires a pending exit");
  const context = await input.source.load(input);
  const execution = deriveReconciliationExecutionAuthority({
    checkpoint: input.checkpoint,
    context,
    observedAt: input.observedAt,
  });
  await record(input.sink, input.checkpoint, input.observedAt, "reconcile", "execution", execution);
}
