import { createHash } from "node:crypto";

import type { PositionWorkerCheckpoint } from "../ports/repositories.js";
import type { PositionMonitoringFacts, PositionReconciliationFacts } from "../ports/runtime.js";
import { InvariantViolationError } from "../../domain/shared/errors.js";
import {
  asUuid,
  type AuditEventId,
  type Brand,
  type EvidenceId,
  type MintAddress,
  type OrderId,
  type Timestamp,
  type WalletAddress,
} from "../../domain/shared/types.js";

export interface ExecutionRuntimeContext {
  readonly wallet: WalletAddress;
  readonly tokenMint: MintAddress;
  readonly settlementMint: MintAddress;
}

export type MonitoringRuntimeHistory = Pick<
  PositionMonitoringFacts,
  | "liquidityUsdTenMinutesAgo"
  | "priorFullExitPriceImpactPercentages"
  | "marketDataUnavailableSince"
  | "allChainAccessUnavailableSince"
  | "evidence"
>;

function deterministicUuid<T extends Brand<string, string>>(...parts: readonly string[]): T {
  const digest = createHash("sha256").update(parts.join("\0")).digest("hex");
  return asUuid<T>(
    `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`,
  );
}

function position(checkpoint: PositionWorkerCheckpoint) {
  const value = checkpoint.runtimeState.lifecycle.position;
  if (value === null || value.id !== checkpoint.positionId)
    throw new InvariantViolationError("Execution authority requires the checkpoint position");
  return value;
}

/** Binds monitoring metadata and deterministic command identities to one checkpoint revision. */
export function deriveMonitoringExecutionAuthority(input: {
  readonly checkpoint: PositionWorkerCheckpoint;
  readonly context: ExecutionRuntimeContext;
  readonly observedAt: Timestamp;
  readonly history: MonitoringRuntimeHistory;
}): Omit<
  PositionMonitoringFacts,
  | "developerRelatedSoldPercentage"
  | "originatingTierASoldPercentage"
  | "confirmingTierBSoldPercentages"
  | "dangerousSecurityChangeDetected"
> {
  if (input.checkpoint.runtimeState.pendingExit !== null)
    throw new InvariantViolationError(
      "Monitoring execution authority cannot target a pending exit",
    );
  if (input.history.priorFullExitPriceImpactPercentages.length > 2)
    throw new InvariantViolationError("Execution authority accepts at most two prior exit impacts");
  if (input.history.evidence.some(({ observedAt }) => observedAt > input.observedAt))
    throw new InvariantViolationError("Execution history evidence cannot be from the future");
  const current = position(input.checkpoint);
  const identity = [input.checkpoint.positionId, input.checkpoint.revision.toString(), "monitor"];
  return Object.freeze({
    stepId: `monitor:${input.checkpoint.positionId}:${input.checkpoint.revision.toString()}`,
    positionId: input.checkpoint.positionId,
    tokenId: current.tokenId,
    observationRequestedAt: input.observedAt,
    evaluatedAt: input.observedAt,
    wallet: input.context.wallet,
    tokenMint: input.context.tokenMint,
    settlementMint: input.context.settlementMint,
    ...input.history,
    orderId: deterministicUuid<OrderId>(...identity, "order"),
    peakEventId: deterministicUuid<AuditEventId>(...identity, "peak"),
    exitRequestedEventId: deterministicUuid<AuditEventId>(...identity, "exit-requested"),
  });
}

/** Binds reconciliation to an acknowledged submission without guessing a signature. */
export function deriveReconciliationExecutionAuthority(input: {
  readonly checkpoint: PositionWorkerCheckpoint;
  readonly context: Pick<ExecutionRuntimeContext, "wallet" | "tokenMint">;
  readonly observedAt: Timestamp;
}): PositionReconciliationFacts {
  const pending = input.checkpoint.runtimeState.pendingExit;
  if (
    pending === null ||
    pending.submission === null ||
    pending.submission.signature.trim().length === 0
  )
    throw new InvariantViolationError(
      "Reconciliation authority requires an acknowledged signature",
    );
  position(input.checkpoint);
  const revision = input.checkpoint.revision.toString();
  return Object.freeze({
    stepId: `reconcile:${input.checkpoint.positionId}:${revision}:${pending.submission.signature}`,
    observationRequestedAt: input.observedAt,
    evaluatedAt: input.observedAt,
    wallet: input.context.wallet,
    tokenMint: input.context.tokenMint,
    eventId: deterministicUuid<AuditEventId>(
      input.checkpoint.positionId,
      revision,
      "reconcile",
      pending.submission.signature,
    ),
  });
}

export function executionAuthorityEvidenceId(input: {
  readonly checkpoint: PositionWorkerCheckpoint;
  readonly phase: "monitor" | "reconcile";
}): EvidenceId {
  return deterministicUuid<EvidenceId>(
    input.checkpoint.positionId,
    input.checkpoint.revision.toString(),
    input.phase,
    "execution-authority",
  );
}
