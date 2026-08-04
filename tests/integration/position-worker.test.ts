import { describe, expect, it } from "vitest";

import type {
  AcknowledgePositionAction,
  PendingPositionAction,
  PositionWorkerCheckpoint,
  PositionWorkerCheckpointRepository,
  SavePositionWorkerTransition,
} from "../../src/application/ports/repositories.js";
import type {
  PositionRuntimeActionDispatcher,
  PositionRuntimeStepSource,
} from "../../src/application/ports/runtime.js";
import {
  createPositionRuntimeState,
  type PositionRuntimeStep,
} from "../../src/application/services/position-monitor.js";
import {
  asNonNegativeDecimal,
  asRawAmount,
  asTimestamp,
  asUuid,
  type AuditEventId,
  type Brand,
  type EvidenceId,
  type OrderId,
  type PositionId,
  type TokenId,
} from "../../src/domain/shared/types.js";
import {
  applyPositionEvent,
  createEmptyPositionLifecycle,
} from "../../src/domain/trading/position.js";
import { runPositionWorkerCycle } from "../../src/workers/position-worker.js";

function uuid<Value extends Brand<string, string>>(suffix: number): Value {
  return asUuid<Value>(`00000000-0000-4000-8000-${suffix.toString().padStart(12, "0")}`);
}

const positionId = uuid<PositionId>(101);
const evaluatedAt = asTimestamp("2026-08-04T12:00:00Z");
const evidence = Object.freeze([
  Object.freeze({
    id: uuid<EvidenceId>(105),
    provider: "solana_rpc" as const,
    observedAt: evaluatedAt,
    sourceKey: "position-worker:observation-1",
  }),
]);

function initialCheckpoint(): PositionWorkerCheckpoint {
  const lifecycle = applyPositionEvent(createEmptyPositionLifecycle(), {
    type: "position:opened",
    eventId: uuid<AuditEventId>(102),
    positionId,
    aggregateVersion: 0n,
    occurredAt: asTimestamp("2026-08-04T11:00:00Z"),
    tokenId: uuid<TokenId>(103),
    entryOrderId: uuid<OrderId>(104),
    acquiredAmount: asRawAmount(1_000n),
    costBasisSol: asNonNegativeDecimal(10),
  });
  return Object.freeze({
    positionId,
    revision: 0n,
    runtimeState: createPositionRuntimeState(lifecycle),
    pendingAction: null,
  });
}

function monitoringStep(): PositionRuntimeStep {
  return Object.freeze({
    type: "monitor",
    stepId: "position-101:observation-1",
    snapshot: Object.freeze({
      evaluatedAt,
      executableValueSol: asNonNegativeDecimal(11),
      emergency: Object.freeze({
        evaluatedAt,
        liquidityUsd: asNonNegativeDecimal(100_000),
        liquidityUsdTenMinutesAgo: asNonNegativeDecimal(100_000),
        developerRelatedSoldPercentage: asNonNegativeDecimal(0),
        originatingTierASoldPercentage: asNonNegativeDecimal(0),
        confirmingTierBSoldPercentages: [asNonNegativeDecimal(0), asNonNegativeDecimal(0)] as const,
        dangerousSecurityChangeDetected: false,
        fullExitPriceImpactPercentages: Object.freeze([
          asNonNegativeDecimal(1),
          asNonNegativeDecimal(1),
          asNonNegativeDecimal(1),
        ]),
        unexplainedBalanceDiscrepancy: false,
        marketDataUnavailableSince: null,
        marketDataAvailabilityKnown: true,
        allChainAccessUnavailableSince: null,
        chainAccessAvailabilityKnown: true,
        evidence,
      }),
      evidence,
    }),
    preparation: Object.freeze({
      orderId: uuid<OrderId>(106),
      quoteFingerprint: "position-worker-quote-1",
      quoteReceivedAt: asTimestamp("2026-08-04T11:59:59Z"),
      sellRouteValid: true,
      simulationSucceeded: true,
      execution: Object.freeze({
        transactionFingerprint: "position-worker-transaction-1",
        quoteFingerprint: "position-worker-quote-1",
        wallet: "Wallet111111111111111111111111111111111111" as never,
        serializedTransactionBase64: Buffer.from("position-worker-transaction-1").toString(
          "base64",
        ),
        lastValidBlockHeight: 1_000n,
        prioritizationFeeLamports: asRawAmount(5_000n),
        evidence,
      }),
      evidence,
      peakEventId: uuid<AuditEventId>(107),
      exitRequestedEventId: uuid<AuditEventId>(108),
    }),
  });
}

class MemoryCheckpoints implements PositionWorkerCheckpointRepository {
  public current = initialCheckpoint();
  public readonly transitions: SavePositionWorkerTransition[] = [];
  public readonly acknowledgements: AcknowledgePositionAction[] = [];
  public failSave = false;
  public failAcknowledge = false;

  public async load(_requested: PositionId): Promise<PositionWorkerCheckpoint> {
    return this.current;
  }

  public async saveTransition(
    input: SavePositionWorkerTransition,
  ): Promise<PositionWorkerCheckpoint> {
    this.transitions.push(input);
    if (this.failSave) throw new Error("save failed");
    if (input.expectedRevision !== this.current.revision)
      throw new Error("checkpoint concurrency conflict");
    if (this.current.pendingAction !== null) throw new Error("pending action exists");
    this.current = Object.freeze({
      positionId: input.positionId,
      revision: this.current.revision + 1n,
      runtimeState: input.runtimeState,
      pendingAction: input.pendingAction,
    });
    return this.current;
  }

  public async acknowledgeAction(
    input: AcknowledgePositionAction,
  ): Promise<PositionWorkerCheckpoint> {
    this.acknowledgements.push(input);
    if (this.failAcknowledge) throw new Error("acknowledgement failed");
    if (input.expectedRevision !== this.current.revision)
      throw new Error("checkpoint concurrency conflict");
    if (this.current.pendingAction?.deliveryId !== input.deliveryId)
      throw new Error("pending delivery mismatch");
    this.current = Object.freeze({
      ...this.current,
      revision: this.current.revision + 1n,
      pendingAction: null,
    });
    return this.current;
  }
}

class StaticSteps implements PositionRuntimeStepSource {
  public calls = 0;

  public async nextStep(): Promise<PositionRuntimeStep> {
    this.calls += 1;
    return monitoringStep();
  }
}

class RecordingActions implements PositionRuntimeActionDispatcher {
  public readonly deliveries: PendingPositionAction[] = [];
  public fail = false;

  public async dispatch(pending: PendingPositionAction): Promise<void> {
    this.deliveries.push(pending);
    if (this.fail) throw new Error("dispatch failed");
  }
}

function dependencies() {
  return {
    checkpoints: new MemoryCheckpoints(),
    steps: new StaticSteps(),
    actions: new RecordingActions(),
  };
}

describe("deterministic position worker boundary", () => {
  it("checkpoints the runtime transition before dispatch and then acknowledges it", async () => {
    const ports = dependencies();
    const result = await runPositionWorkerCycle(positionId, ports);
    expect(result.action.type).toBe("continue_monitoring");
    expect(result.recoveredPendingAction).toBe(false);
    expect(ports.checkpoints.transitions).toHaveLength(1);
    expect(ports.actions.deliveries).toHaveLength(1);
    expect(ports.checkpoints.acknowledgements).toHaveLength(1);
    expect(result.checkpoint).toMatchObject({ revision: 2n, pendingAction: null });
  });

  it("persists emitted events in the same transition as the pending action", async () => {
    const ports = dependencies();
    await runPositionWorkerCycle(positionId, ports);
    const saved = ports.checkpoints.transitions[0];
    expect(saved?.emittedEvents.map(({ type }) => type)).toEqual([
      "position:executable-peak-recorded",
    ]);
    expect(saved?.pendingAction.deliveryId).toBe(`${positionId}:position-101:observation-1`);
    expect(saved?.runtimeState.processedSteps).toHaveLength(1);
  });

  it("leaves a durable pending action when dispatch fails", async () => {
    const ports = dependencies();
    ports.actions.fail = true;
    await expect(runPositionWorkerCycle(positionId, ports)).rejects.toThrow("dispatch failed");
    expect(ports.checkpoints.current.revision).toBe(1n);
    expect(ports.checkpoints.current.pendingAction).not.toBeNull();
    expect(ports.checkpoints.acknowledgements).toEqual([]);
  });

  it("replays a pending action without acquiring or applying a new step", async () => {
    const ports = dependencies();
    ports.actions.fail = true;
    await expect(runPositionWorkerCycle(positionId, ports)).rejects.toThrow("dispatch failed");
    const firstDelivery = ports.actions.deliveries[0];
    ports.actions.fail = false;
    const result = await runPositionWorkerCycle(positionId, ports);
    expect(result.recoveredPendingAction).toBe(true);
    expect(ports.steps.calls).toBe(1);
    expect(ports.checkpoints.transitions).toHaveLength(1);
    expect(ports.actions.deliveries[1]).toEqual(firstDelivery);
    expect(result.checkpoint.pendingAction).toBeNull();
  });

  it("redelivers the same identity when acknowledgement fails after dispatch", async () => {
    const ports = dependencies();
    ports.checkpoints.failAcknowledge = true;
    await expect(runPositionWorkerCycle(positionId, ports)).rejects.toThrow(
      "acknowledgement failed",
    );
    ports.checkpoints.failAcknowledge = false;
    await runPositionWorkerCycle(positionId, ports);
    expect(ports.actions.deliveries).toHaveLength(2);
    expect(ports.actions.deliveries[1]?.deliveryId).toBe(ports.actions.deliveries[0]?.deliveryId);
    expect(ports.steps.calls).toBe(1);
  });

  it("never dispatches an uncommitted action when persistence fails", async () => {
    const ports = dependencies();
    ports.checkpoints.failSave = true;
    await expect(runPositionWorkerCycle(positionId, ports)).rejects.toThrow("save failed");
    expect(ports.actions.deliveries).toEqual([]);
    expect(ports.checkpoints.current.revision).toBe(0n);
  });

  it("does not redeliver an already acknowledged observation step", async () => {
    const ports = dependencies();
    await runPositionWorkerCycle(positionId, ports);
    const repeated = await runPositionWorkerCycle(positionId, ports);
    expect(repeated.action.type).toBe("continue_monitoring");
    expect(ports.steps.calls).toBe(2);
    expect(ports.checkpoints.transitions).toHaveLength(1);
    expect(ports.actions.deliveries).toHaveLength(1);
    expect(repeated.checkpoint.revision).toBe(2n);
  });

  it("rejects concurrent advancement before any external effect", async () => {
    const ports = dependencies();
    const originalSave = ports.checkpoints.saveTransition.bind(ports.checkpoints);
    ports.checkpoints.saveTransition = async (input) =>
      originalSave({ ...input, expectedRevision: input.expectedRevision + 1n });
    await expect(runPositionWorkerCycle(positionId, ports)).rejects.toThrow(
      "checkpoint concurrency conflict",
    );
    expect(ports.actions.deliveries).toEqual([]);
  });

  it("rejects a checkpoint for a different position", async () => {
    const ports = dependencies();
    ports.checkpoints.current = Object.freeze({
      ...ports.checkpoints.current,
      positionId: uuid<PositionId>(999),
    });
    await expect(runPositionWorkerCycle(positionId, ports)).rejects.toThrow("different position");
    expect(ports.steps.calls).toBe(0);
  });

  it("rejects a pending delivery that is not bound to its processed step", async () => {
    const ports = dependencies();
    ports.actions.fail = true;
    await expect(runPositionWorkerCycle(positionId, ports)).rejects.toThrow("dispatch failed");
    ports.checkpoints.current = Object.freeze({
      ...ports.checkpoints.current,
      pendingAction: Object.freeze({
        ...ports.checkpoints.current.pendingAction!,
        stepFingerprint: "forged",
      }),
    });
    await expect(runPositionWorkerCycle(positionId, ports)).rejects.toThrow(
      "does not match processed runtime step",
    );
  });
});
