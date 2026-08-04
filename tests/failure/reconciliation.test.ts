import { describe, expect, it } from "vitest";

import type {
  ChainBalanceObservation,
  ChainTransactionObservation,
  ObservationResult,
  ObservationTrace,
} from "../../src/application/contracts/observations.js";
import type {
  ChainObservationPort,
  ChainTransactionObservationPort,
} from "../../src/application/ports/chain.js";
import type { PositionWorkerCheckpoint } from "../../src/application/ports/repositories.js";
import type {
  PositionReconciliationFacts,
  PositionReconciliationFactsSource,
} from "../../src/application/ports/runtime.js";
import {
  ObservedPositionReconciliationStepSource,
  PositionReconciliationUnavailableError,
} from "../../src/application/services/reconciliation.js";
import {
  processPositionRuntimeStep,
  restorePositionRuntimeState,
} from "../../src/application/services/position-monitor.js";
import {
  asNonNegativeDecimal,
  asRawAmount,
  asSolanaSlot,
  asTimestamp,
  asUuid,
  type AuditEventId,
  type Brand,
  type EvidenceId,
  type OrderId,
  type PositionId,
  type TokenId,
  type WalletAddress,
} from "../../src/domain/shared/types.js";
import { asMintAddress } from "../../src/domain/token/token.js";
import { createEmergencyExitIntent } from "../../src/domain/trading/order.js";
import {
  applyPositionEvent,
  createEmptyPositionLifecycle,
} from "../../src/domain/trading/position.js";

function uuid<Value extends Brand<string, string>>(suffix: number): Value {
  return asUuid<Value>(`00000000-0000-4000-8000-${suffix.toString().padStart(12, "0")}`);
}

const requestedAt = asTimestamp("2026-08-04T14:00:00Z");
const evaluatedAt = asTimestamp("2026-08-04T14:00:01Z");
const wallet = "Wallet111111111111111111111111111111111111" as WalletAddress;
const mint = asMintAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const positionId = uuid<PositionId>(901);

function trace(provider: "helius" | "solana_rpc", suffix: number): ObservationTrace {
  return Object.freeze({
    evidenceId: uuid<EvidenceId>(suffix),
    provider,
    method: "rpc",
    requestedAt,
    respondedAt: evaluatedAt,
    sourceTimestamp: null,
    normalizedAt: evaluatedAt,
    sourceKey: `${provider}:${suffix}`,
    contentHash: `${suffix}`.padStart(64, "0"),
    slot: asSolanaSlot(500n),
  });
}

function checkpoint(): PositionWorkerCheckpoint {
  let lifecycle = applyPositionEvent(createEmptyPositionLifecycle(), {
    type: "position:opened",
    eventId: uuid<AuditEventId>(902),
    positionId,
    aggregateVersion: 0n,
    occurredAt: asTimestamp("2026-08-04T13:00:00Z"),
    tokenId: uuid<TokenId>(903),
    entryOrderId: uuid<OrderId>(904),
    acquiredAmount: asRawAmount(1_000n),
    costBasisSol: asNonNegativeDecimal(1),
  });
  const intent = createEmergencyExitIntent({
    orderId: uuid<OrderId>(905),
    positionId,
    positionVersion: lifecycle.position!.version,
    currentAmount: asRawAmount(1_000n),
    quoteFingerprint: "quote-1",
    emergencyRuleIds: ["EMG-008"],
    evidence: [
      {
        id: uuid<EvidenceId>(906),
        provider: "helius",
        observedAt: requestedAt,
        sourceKey: "exit-evidence",
      },
    ],
    quoteFresh: true,
    sellRouteValid: true,
    simulationSucceeded: true,
    createdAt: requestedAt,
  });
  lifecycle = applyPositionEvent(lifecycle, {
    type: "position:exit-requested",
    eventId: uuid<AuditEventId>(907),
    positionId,
    aggregateVersion: lifecycle.version + 1n,
    occurredAt: requestedAt,
  });
  return Object.freeze({
    positionId,
    revision: 4n,
    runtimeState: restorePositionRuntimeState({
      lifecycle,
      pendingExit: Object.freeze({
        intent,
        decision: Object.freeze({
          action: "full" as const,
          ruleId: "EMG-008",
          requestedAmount: asRawAmount(1_000n),
          results: Object.freeze([]),
        }),
        submission: Object.freeze({
          provider: "helius" as const,
          signature: "signature-901",
          acknowledgedAt: requestedAt,
        }),
      }),
      processedSteps: Object.freeze([]),
    }),
    pendingAction: null,
  });
}

function transaction(
  overrides: Partial<ChainTransactionObservation> = {},
): ChainTransactionObservation {
  return Object.freeze({
    signature: "signature-901",
    state: "confirmed",
    slot: asSolanaSlot(500n),
    onChainError: false,
    wallet,
    mint,
    tokenBalanceBeforeRaw: asRawAmount(1_000n),
    tokenBalanceAfterRaw: asRawAmount(0n),
    nativeBalanceBeforeLamports: asRawAmount(1_000_000_000n),
    nativeBalanceAfterLamports: asRawAmount(2_200_000_000n),
    feeLamports: asRawAmount(5_000n),
    tipLamports: asRawAmount(0n),
    agreeingProviders: Object.freeze(["helius", "solana_rpc"] as const),
    traces: Object.freeze([trace("helius", 908), trace("solana_rpc", 909)]),
    ...overrides,
  });
}

function balance(amount = 0n): ChainBalanceObservation {
  return Object.freeze({
    wallet,
    mint,
    nativeBalanceLamports: asRawAmount(2_200_000_000n),
    tokenBalanceRaw: asRawAmount(amount),
    slot: asSolanaSlot(501n),
    agreeingProviders: Object.freeze(["helius", "solana_rpc"] as const),
    traces: Object.freeze([trace("helius", 910), trace("solana_rpc", 911)]),
  });
}

class Facts implements PositionReconciliationFactsSource {
  public async loadFacts(): Promise<PositionReconciliationFacts> {
    return Object.freeze({
      stepId: "position-901:reconcile:1",
      observationRequestedAt: requestedAt,
      evaluatedAt,
      wallet,
      tokenMint: mint,
      eventId: uuid<AuditEventId>(912),
    });
  }
}

function source(
  transactionValue: ObservationResult<ChainTransactionObservation>,
  balanceValue: ObservationResult<ChainBalanceObservation> = { ok: true, value: balance() },
) {
  const transactions: ChainTransactionObservationPort = {
    observeTransaction: async () => transactionValue,
  };
  const balances: ChainObservationPort = { observeBalances: async () => balanceValue };
  return new ObservedPositionReconciliationStepSource(new Facts(), transactions, balances);
}

describe("authoritative exit reconciliation", () => {
  it("closes only after the acknowledged signature and wallet balances agree", async () => {
    const current = checkpoint();
    const step = await source({ ok: true, value: transaction() }).nextStep(current);
    const result = processPositionRuntimeStep(current.runtimeState, step);
    expect(result.action.type).toBe("position_closed");
    expect(result.state.lifecycle.position).toMatchObject({ state: "closed", currentAmount: 0n });
  });

  it("keeps a transaction pending without reading balances", async () => {
    let balanceReads = 0;
    const transactions: ChainTransactionObservationPort = {
      observeTransaction: async () => ({
        ok: true,
        value: transaction({ state: "pending", slot: null, onChainError: null }),
      }),
    };
    const balances: ChainObservationPort = {
      observeBalances: async () => {
        balanceReads += 1;
        return { ok: true, value: balance() };
      },
    };
    const step = await new ObservedPositionReconciliationStepSource(
      new Facts(),
      transactions,
      balances,
    ).nextStep(checkpoint());
    const result = processPositionRuntimeStep(checkpoint().runtimeState, step);
    expect(result.action).toMatchObject({ type: "await_reconciliation", reason: "pending" });
    expect(balanceReads).toBe(0);
  });

  it("refuses closure when post-transaction and current balances disagree", async () => {
    const current = checkpoint();
    const step = await source(
      { ok: true, value: transaction({ tokenBalanceAfterRaw: asRawAmount(0n) }) },
      { ok: true, value: balance(1n) },
    ).nextStep(current);
    expect(processPositionRuntimeStep(current.runtimeState, step).action).toMatchObject({
      type: "await_reconciliation",
      reason: "balance_mismatch",
    });
  });

  it("does not treat an on-chain failure as a successful exit", async () => {
    const current = checkpoint();
    const step = await source({
      ok: true,
      value: transaction({ state: "failed", onChainError: true }),
    }).nextStep(current);
    expect(processPositionRuntimeStep(current.runtimeState, step).action).toMatchObject({
      type: "await_reconciliation",
      reason: "on_chain_failure",
    });
  });

  it("classifies total transaction-provider failure without fabricating a step", async () => {
    await expect(
      source({
        ok: false,
        error: {
          code: "unavailable",
          provider: "solana_rpc",
          occurredAt: evaluatedAt,
          retryable: true,
          reason: "offline",
        },
      }).nextStep(checkpoint()),
    ).rejects.toEqual(
      new PositionReconciliationUnavailableError("transaction", "unavailable", true, "offline"),
    );
  });
});
