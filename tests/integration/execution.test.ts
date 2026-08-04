import { describe, expect, it } from "vitest";

import type {
  InitializePositionWorkerCheckpoint,
  PositionOpeningRepository,
  PositionWorkerCheckpoint,
} from "../../src/application/ports/repositories.js";
import type { PositionRuntimeAuthorityBaseline } from "../../src/application/ports/runtime-authority-inputs.js";
import { openReconciledPosition } from "../../src/application/services/execution.js";
import {
  createPositionRuntimeState,
  processPositionRuntimeStep,
  restorePositionRuntimeState,
  type ExitPreparation,
  type PositionRuntimeStep,
} from "../../src/application/services/position-monitor.js";
import type { EvidenceReference } from "../../src/domain/shared/evidence.js";
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
import type { EntryReconciliation, ExitReconciliation } from "../../src/domain/trading/order.js";
import {
  applyPositionEvent,
  createEmptyPositionLifecycle,
} from "../../src/domain/trading/position.js";

function uuid<Value extends Brand<string, string>>(suffix: number): Value {
  return asUuid<Value>(`00000000-0000-4000-8000-${suffix.toString().padStart(12, "0")}`);
}

const positionId = uuid<PositionId>(1);
const openedAt = asTimestamp("2026-08-04T10:00:00Z");
const evaluatedAt = asTimestamp("2026-08-04T10:01:00Z");
const evidence: readonly EvidenceReference[] = Object.freeze([
  {
    id: uuid<EvidenceId>(4),
    provider: "solana_rpc",
    observedAt: evaluatedAt,
    sourceKey: "runtime:position-1",
  },
]);

function lifecycle() {
  return applyPositionEvent(createEmptyPositionLifecycle(), {
    type: "position:opened",
    eventId: uuid<AuditEventId>(2),
    positionId,
    aggregateVersion: 0n,
    occurredAt: openedAt,
    tokenId: uuid<TokenId>(3),
    entryOrderId: uuid<OrderId>(5),
    acquiredAmount: asRawAmount(1_000n),
    costBasisSol: asNonNegativeDecimal(10),
  });
}

function emergency(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

function preparation(overrides: Partial<ExitPreparation> = {}): ExitPreparation {
  return {
    orderId: uuid<OrderId>(6),
    quoteFingerprint: "sell-runtime-q1",
    quoteReceivedAt: asTimestamp("2026-08-04T10:00:58Z"),
    sellRouteValid: true,
    simulationSucceeded: true,
    execution: Object.freeze({
      transactionFingerprint: "transaction-runtime-1",
      quoteFingerprint: "sell-runtime-q1",
      quoteReceivedAt: asTimestamp("2026-08-04T10:00:58Z"),
      wallet: "Wallet111111111111111111111111111111111111" as never,
      serializedTransactionBase64: Buffer.from("transaction-runtime-1").toString("base64"),
      lastValidBlockHeight: 1_000n,
      prioritizationFeeLamports: asRawAmount(5_000n),
      evidence,
    }),
    evidence,
    peakEventId: uuid<AuditEventId>(7),
    exitRequestedEventId: uuid<AuditEventId>(8),
    ...overrides,
  };
}

function monitor(
  executableValue = 10,
  overrides: Partial<Extract<PositionRuntimeStep, { type: "monitor" }>> = {},
): Extract<PositionRuntimeStep, { type: "monitor" }> {
  return {
    type: "monitor",
    stepId: "monitor-1",
    snapshot: {
      evaluatedAt,
      executableValueSol: asNonNegativeDecimal(executableValue),
      emergency: emergency(),
      evidence,
    },
    preparation: preparation(),
    ...overrides,
  };
}

function reconciliation(overrides: Partial<ExitReconciliation> = {}): ExitReconciliation {
  return {
    evaluatedAt: asTimestamp("2026-08-04T10:01:01Z"),
    transactionConfirmed: true,
    onChainError: false,
    tokenBalanceDecrease: asRawAmount(400n),
    reconciledRemainingAmount: asRawAmount(600n),
    solBalanceIncrease: asRawAmount(5_000_000_000n),
    feePaid: asRawAmount(5_000n),
    tipPaid: asRawAmount(1_000n),
    signature: "sig-runtime-1",
    expectedSignature: "sig-runtime-1",
    evidence,
    ...overrides,
  };
}

describe("deterministic position runtime orchestration", () => {
  it("records a new peak and continues monitoring when no exit triggers", () => {
    const result = processPositionRuntimeStep(createPositionRuntimeState(lifecycle()), monitor(11));
    expect(result.action.type).toBe("continue_monitoring");
    expect(result.emittedEvents.map(({ type }) => type)).toEqual([
      "position:executable-peak-recorded",
    ]);
    expect(result.state.lifecycle.position?.peakExecutableValueSol.equals(11)).toBe(true);
  });

  it("creates one version-bound standard intent and moves to exit_pending", () => {
    const result = processPositionRuntimeStep(createPositionRuntimeState(lifecycle()), monitor(13));
    expect(result.action.type).toBe("submit_exit");
    expect(result.emittedEvents.map(({ type }) => type)).toEqual([
      "position:executable-peak-recorded",
      "position:exit-requested",
    ]);
    expect(result.state.pendingExit?.decision.ruleId).toBe("EXT-002");
    expect(result.state.pendingExit?.intent.positionVersion).toBe(1n);
    expect(result.state.lifecycle.position?.state).toBe("exit_pending");
    expect(result.action.type === "submit_exit" && result.action.execution).toMatchObject({
      transactionFingerprint: "transaction-runtime-1",
      quoteFingerprint: "sell-runtime-q1",
      lastValidBlockHeight: 1_000n,
    });
  });

  it("gives emergency evidence precedence over a simultaneous profit target", () => {
    const step = monitor(13, {
      snapshot: {
        evaluatedAt,
        executableValueSol: asNonNegativeDecimal(13),
        emergency: emergency({ liquidityUsd: asNonNegativeDecimal(40_000) }),
        evidence,
      },
    });
    const result = processPositionRuntimeStep(createPositionRuntimeState(lifecycle()), step);
    expect(result.state.pendingExit?.decision.ruleId).toBe("EMG-001");
    expect(
      "emergencyRuleIds" in result.state.pendingExit!.intent
        ? result.state.pendingExit!.intent.emergencyRuleIds
        : [],
    ).toEqual(["EMG-001", "EMG-002"]);
    expect(result.state.pendingExit?.intent.requestedAmount).toBe(1_000n);
    expect("emergencyRuleIds" in result.state.pendingExit!.intent).toBe(true);
  });

  it("computes emergency quote freshness internally", () => {
    const step = monitor(10, {
      snapshot: {
        evaluatedAt,
        executableValueSol: asNonNegativeDecimal(10),
        emergency: emergency({ liquidityUsd: asNonNegativeDecimal(40_000) }),
        evidence,
      },
      preparation: preparation({ quoteReceivedAt: asTimestamp("2026-08-04T10:00:57.999Z") }),
    });
    expect(() => processPositionRuntimeStep(createPositionRuntimeState(lifecycle()), step)).toThrow(
      "fresh valid simulated",
    );
  });

  it("keeps an unproven reconciliation pending without emitting an event", () => {
    const submitted = processPositionRuntimeStep(
      createPositionRuntimeState(lifecycle()),
      monitor(13),
    );
    const result = processPositionRuntimeStep(submitted.state, {
      type: "reconcile",
      stepId: "reconcile-1",
      reconciliation: reconciliation({ signature: "wrong" }),
      eventId: uuid<AuditEventId>(9),
    });
    expect(result.action.type).toBe("await_reconciliation");
    expect(result.state.pendingExit).not.toBeNull();
    expect(result.emittedEvents).toEqual([]);
  });

  it("reconciles a completed first tranche and records target satisfaction", () => {
    const submitted = processPositionRuntimeStep(
      createPositionRuntimeState(lifecycle()),
      monitor(13),
    );
    const result = processPositionRuntimeStep(submitted.state, {
      type: "reconcile",
      stepId: "reconcile-1",
      reconciliation: reconciliation(),
      eventId: uuid<AuditEventId>(9),
    });
    expect(result.action.type).toBe("exit_reconciled");
    expect(result.state.pendingExit).toBeNull();
    expect(result.state.lifecycle.position?.currentAmount).toBe(600n);
    expect(result.state.lifecycle.position?.firstTargetSatisfied).toBe(true);
  });

  it("does not satisfy a tranche after only a partial fill", () => {
    const submitted = processPositionRuntimeStep(
      createPositionRuntimeState(lifecycle()),
      monitor(13),
    );
    const result = processPositionRuntimeStep(submitted.state, {
      type: "reconcile",
      stepId: "reconcile-partial",
      reconciliation: reconciliation({
        tokenBalanceDecrease: asRawAmount(150n),
        reconciledRemainingAmount: asRawAmount(850n),
      }),
      eventId: uuid<AuditEventId>(10),
    });
    expect(result.state.lifecycle.position?.currentAmount).toBe(850n);
    expect(result.state.lifecycle.position?.firstTargetSatisfied).toBe(false);
    expect(result.emittedEvents[0]).toMatchObject({ target: "continuation" });
    expect(result.action.type).toBe("refresh_exit");
  });

  it("closes only after authoritative zero-balance reconciliation", () => {
    const emergencyStep = monitor(10, {
      snapshot: {
        evaluatedAt,
        executableValueSol: asNonNegativeDecimal(10),
        emergency: emergency({ liquidityUsd: asNonNegativeDecimal(40_000) }),
        evidence,
      },
    });
    const submitted = processPositionRuntimeStep(
      createPositionRuntimeState(lifecycle()),
      emergencyStep,
    );
    const result = processPositionRuntimeStep(submitted.state, {
      type: "reconcile",
      stepId: "reconcile-close",
      reconciliation: reconciliation({
        tokenBalanceDecrease: asRawAmount(1_000n),
        reconciledRemainingAmount: asRawAmount(0n),
      }),
      eventId: uuid<AuditEventId>(11),
    });
    expect(result.action.type).toBe("position_closed");
    expect(result.state.lifecycle.position?.state).toBe("closed");
  });

  it("replays the same idempotent action but no events after restart", () => {
    const step = monitor(13);
    const first = processPositionRuntimeStep(createPositionRuntimeState(lifecycle()), step);
    const duplicate = processPositionRuntimeStep(restorePositionRuntimeState(first.state), step);
    expect(duplicate.action.type).toBe("submit_exit");
    expect(duplicate.action).toEqual(first.action);
    expect(duplicate.actionId).toBe(step.stepId);
    expect(duplicate.state).toEqual(first.state);
    expect(duplicate.emittedEvents).toEqual([]);
  });

  it("rejects changed content under a processed step identity", () => {
    const first = processPositionRuntimeStep(createPositionRuntimeState(lifecycle()), monitor(11));
    expect(() => processPositionRuntimeStep(first.state, monitor(12))).toThrow(
      "reused with different content",
    );
  });

  it("rejects monitoring while an exit is pending and invalid restored checkpoints", () => {
    const submitted = processPositionRuntimeStep(
      createPositionRuntimeState(lifecycle()),
      monitor(13),
    );
    expect(() =>
      processPositionRuntimeStep(submitted.state, { ...monitor(13), stepId: "monitor-2" }),
    ).toThrow("awaits reconciliation");
    expect(() => restorePositionRuntimeState({ ...submitted.state, pendingExit: null })).toThrow(
      "requires a pending exit",
    );
  });

  it("requires preparation only when identity or execution is needed", () => {
    expect(
      processPositionRuntimeStep(
        createPositionRuntimeState(lifecycle()),
        monitor(10, { preparation: null }),
      ).action.type,
    ).toBe("continue_monitoring");
    expect(() =>
      processPositionRuntimeStep(
        createPositionRuntimeState(lifecycle()),
        monitor(8, { preparation: null }),
      ),
    ).toThrow("execution preparation");
  });
});

const entryEvaluatedAt = asTimestamp("2026-08-04T17:00:00Z");
const entryPositionId = uuid<PositionId>(501);
const entryTokenId = uuid<TokenId>(502);
const entryOrderId = uuid<OrderId>(503);
const entryOpenedEventId = uuid<AuditEventId>(504);
const entryEvidence: readonly EvidenceReference[] = Object.freeze([
  Object.freeze({
    id: uuid<EvidenceId>(505),
    provider: "solana_rpc",
    observedAt: entryEvaluatedAt,
    sourceKey: "entry-opening:reconciliation",
  }),
]);

function entryReconciliation(overrides: Partial<EntryReconciliation> = {}): EntryReconciliation {
  return Object.freeze({
    evaluatedAt: entryEvaluatedAt,
    transactionConfirmed: true,
    onChainError: false,
    tokenBalanceIncrease: asRawAmount(2_000n),
    solBalanceDecrease: asRawAmount(1_500_000_000n),
    feePaid: asRawAmount(5_000n),
    tipPaid: asRawAmount(0n),
    minimumOutputAmount: asRawAmount(1_900n),
    signature: "entry-signature",
    evidence: entryEvidence,
    ...overrides,
  });
}

function entryBaseline(capturedAt = entryEvaluatedAt): PositionRuntimeAuthorityBaseline {
  return Object.freeze({
    capturedAt,
    wallet: "trader" as never,
    tokenMint: "token-mint" as never,
    settlementMint: "settlement-mint" as never,
    developerRelated: Object.freeze([]),
    originatingTierA: null,
    confirmingTierB: null,
    excludedHolderTokenAccounts: new Set<string>(),
    entrySecurity: Object.freeze({
      observedAt: entryEvaluatedAt,
      evidence: entryEvidence,
      directlyVerifiedOnChain: true,
      program: "spl_token",
      mintAuthority: "revoked",
      freezeAuthority: "revoked",
      extensions: Object.freeze([]),
      extensionsVerified: true,
      holders: null,
    }),
    history: Object.freeze({
      liquidityUsdTenMinutesAgo: null,
      priorFullExitPriceImpactPercentages: Object.freeze([]),
      marketDataUnavailableSince: null,
      allChainAccessUnavailableSince: null,
      evidence: Object.freeze([]),
    }),
  });
}

class RecordingOpeningRepository implements PositionOpeningRepository {
  public calls: InitializePositionWorkerCheckpoint[] = [];
  public failure: Error | null = null;

  public async initialize(
    input: InitializePositionWorkerCheckpoint,
  ): Promise<PositionWorkerCheckpoint> {
    this.calls.push(input);
    if (this.failure !== null) throw this.failure;
    return Object.freeze({
      positionId: input.positionId,
      revision: 0n,
      runtimeState: input.runtimeState,
      pendingAction: null,
    });
  }
}

const entryOpeningInput = (
  overrides: Partial<Parameters<typeof openReconciledPosition>[0]> = {},
) => ({
  positionId: entryPositionId,
  tokenId: entryTokenId,
  entryOrderId,
  openedEventId: entryOpenedEventId,
  reconciliation: entryReconciliation(),
  authorityBaseline: entryBaseline(),
  ...overrides,
});

describe("reconciled entry position opening", () => {
  it("creates the exact reconciled position and delegates one atomic initialization", async () => {
    const repository = new RecordingOpeningRepository();
    const opening = entryOpeningInput();
    const result = await openReconciledPosition(opening, repository);

    expect(repository.calls).toHaveLength(1);
    expect(result.openedEvent).toMatchObject({
      positionId: entryPositionId,
      tokenId: entryTokenId,
      entryOrderId,
      acquiredAmount: 2_000n,
    });
    expect(result.openedEvent.costBasisSol.toString()).toBe("1.5");
    expect(result.checkpoint.runtimeState.lifecycle.position).toMatchObject({
      id: entryPositionId,
      state: "open",
      originalAmount: 2_000n,
    });
    expect(repository.calls[0]?.authorityBaseline).toBe(opening.authorityBaseline);
  });

  it("rejects an unsuccessful entry without invoking persistence", async () => {
    const repository = new RecordingOpeningRepository();
    await expect(
      openReconciledPosition(
        entryOpeningInput({
          reconciliation: entryReconciliation({ transactionConfirmed: false }),
        }),
        repository,
      ),
    ).rejects.toThrow(/successful reconciled entry/);
    expect(repository.calls).toHaveLength(0);
  });

  it("rejects a baseline not captured at reconciliation", async () => {
    const repository = new RecordingOpeningRepository();
    await expect(
      openReconciledPosition(
        entryOpeningInput({
          authorityBaseline: entryBaseline(asTimestamp("2026-08-04T17:00:01Z")),
        }),
        repository,
      ),
    ).rejects.toThrow(/captured at entry reconciliation/);
    expect(repository.calls).toHaveLength(0);
  });

  it("propagates atomic repository failure without returning an opened position", async () => {
    const repository = new RecordingOpeningRepository();
    repository.failure = new Error("opening transaction failed");
    await expect(openReconciledPosition(entryOpeningInput(), repository)).rejects.toThrow(
      "opening transaction failed",
    );
    expect(repository.calls).toHaveLength(1);
  });
});
