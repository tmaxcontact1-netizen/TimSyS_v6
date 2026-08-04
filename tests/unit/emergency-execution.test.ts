import { describe, expect, it } from "vitest";

import {
  createEmergencyExitIntent,
  createSubmissionAttempt,
  evaluateSuccessfulExit,
  markAttemptFailed,
  planExitRetry,
  type ExitReconciliation,
  type Order,
  type SubmissionAttempt,
} from "../../src/domain/trading/order.js";
import {
  createReconciledPosition,
  markExitPending,
  reconcileExit,
} from "../../src/domain/trading/position.js";
import {
  asNonNegativeDecimal,
  asRawAmount,
  asTimestamp,
  asUuid,
  type EvidenceId,
  type OrderId,
  type PositionId,
  type TokenId,
} from "../../src/domain/shared/types.js";

const at = asTimestamp("2026-08-04T12:00:00Z");
const evidence = Object.freeze([
  {
    id: asUuid<EvidenceId>("00000000-0000-4000-8000-000000000091"),
    provider: "solana_rpc" as const,
    observedAt: at,
    sourceKey: "emergency:position-1",
  },
]);
const positionId = asUuid<PositionId>("00000000-0000-4000-8000-000000000092");

function intent() {
  return createEmergencyExitIntent({
    orderId: asUuid<OrderId>("00000000-0000-4000-8000-000000000093"),
    positionId,
    positionVersion: 4n,
    currentAmount: asRawAmount(1_000n),
    quoteFingerprint: "sell-quote-v1",
    emergencyRuleIds: ["EMG-006", "EMG-002"],
    evidence,
    quoteFresh: true,
    sellRouteValid: true,
    simulationSucceeded: true,
    createdAt: at,
  });
}

function reconciliation(overrides: Partial<ExitReconciliation> = {}): ExitReconciliation {
  return {
    evaluatedAt: asTimestamp("2026-08-04T12:00:01Z"),
    transactionConfirmed: true,
    onChainError: false,
    tokenBalanceDecrease: asRawAmount(1_000n),
    reconciledRemainingAmount: asRawAmount(0n),
    solBalanceIncrease: asRawAmount(2_000_000_000n),
    feePaid: asRawAmount(5_000n),
    tipPaid: asRawAmount(1_000n),
    signature: "signature-1",
    expectedSignature: "signature-1",
    evidence,
    ...overrides,
  };
}

function failedAttempts(count: number): SubmissionAttempt[] {
  const signing = { ...intent().order, state: "signing", version: 4n } as Order;
  const attempts: SubmissionAttempt[] = [];
  for (let index = 0; index < count; index += 1) {
    attempts.push(
      markAttemptFailed(createSubmissionAttempt(signing, attempts, "primary", at), "RPC_FAILED"),
    );
  }
  return attempts;
}

describe("emergency exit execution", () => {
  it("binds one full sell intent to position version, rules, evidence, amount, and quote", () => {
    const value = intent();
    expect(value.order.side).toBe("sell");
    expect(value.requestedAmount).toBe(1_000n);
    expect(value.emergencyRuleIds).toEqual(["EMG-002", "EMG-006"]);
    expect(value.order.idempotencyKey).toContain(`${positionId}:4`);
    expect(Object.isFrozen(value)).toBe(true);
  });

  it.each(["quoteFresh", "sellRouteValid", "simulationSucceeded"] as const)(
    "rejects an emergency order when %s is false",
    (field) => {
      const base = {
        orderId: asUuid<OrderId>("00000000-0000-4000-8000-000000000093"),
        positionId,
        positionVersion: 4n,
        currentAmount: asRawAmount(1_000n),
        quoteFingerprint: "q",
        emergencyRuleIds: ["EMG-001"],
        evidence,
        quoteFresh: true,
        sellRouteValid: true,
        simulationSucceeded: true,
        createdAt: at,
      };
      expect(() => createEmergencyExitIntent({ ...base, [field]: false })).toThrow(
        "fresh valid simulated",
      );
    },
  );

  it("rejects missing emergency rules, evidence, and invalid position state facts", () => {
    const base = {
      orderId: asUuid<OrderId>("00000000-0000-4000-8000-000000000093"),
      positionId,
      positionVersion: 4n,
      currentAmount: asRawAmount(1_000n),
      quoteFingerprint: "q",
      emergencyRuleIds: ["EMG-001"],
      evidence,
      quoteFresh: true,
      sellRouteValid: true,
      simulationSucceeded: true,
      createdAt: at,
    };
    expect(() => createEmergencyExitIntent({ ...base, emergencyRuleIds: [] })).toThrow("rules");
    expect(() => createEmergencyExitIntent({ ...base, evidence: [] })).toThrow("evidence");
    expect(() => createEmergencyExitIntent({ ...base, currentAmount: asRawAmount(0n) })).toThrow(
      "positive",
    );
  });

  it.each([
    [1, false, false, false, 0],
    [2, true, false, false, 0],
    [3, true, true, false, 0],
    [5, true, true, true, 10_000],
  ] as const)(
    "plans deterministic retry escalation after %i failures",
    (count, raised, fallback, alert, delay) => {
      const plan = planExitRetry(failedAttempts(count), at);
      expect(plan.nextAttemptNumber).toBe(BigInt(count + 1));
      expect(plan.raisePriorityOneTier).toBe(raised);
      expect(plan.useFallbackSubmission).toBe(fallback);
      expect(plan.criticalAlert).toBe(alert);
      expect(Date.parse(plan.earliestRetryAt) - Date.parse(at)).toBe(delay);
      expect(
        plan.latestAutomaticAttemptAt === null
          ? null
          : Date.parse(plan.latestAutomaticAttemptAt) - Date.parse(at),
      ).toBe(count < 5 ? 3_000 : null);
    },
  );

  it("rejects a retry history containing attempts from different orders", () => {
    const attempts = failedAttempts(2);
    const mixed = [
      attempts[0]!,
      { ...attempts[1]!, orderId: asUuid<OrderId>("00000000-0000-4000-8000-000000000096") },
    ];
    expect(() => planExitRetry(mixed, at)).toThrow("one order");
  });

  it("does not treat confirmation or a signature alone as reconciled closure", () => {
    const decision = evaluateSuccessfulExit(
      intent(),
      reconciliation({ tokenBalanceDecrease: null, reconciledRemainingAmount: null }),
    );
    expect(decision.reconciled).toBe(false);
    expect(decision.closed).toBe(false);
    expect(decision.soldAmount).toBeNull();
  });

  it("rejects a mismatched signature and impossible authoritative balance delta", () => {
    expect(
      evaluateSuccessfulExit(intent(), reconciliation({ signature: "other" })).reconciled,
    ).toBe(false);
    expect(
      evaluateSuccessfulExit(
        intent(),
        reconciliation({
          tokenBalanceDecrease: asRawAmount(900n),
          reconciledRemainingAmount: asRawAmount(0n),
        }),
      ).reconciled,
    ).toBe(false);
  });

  it("reconciles a partial fill but requires continuation against actual remaining quantity", () => {
    const decision = evaluateSuccessfulExit(
      intent(),
      reconciliation({
        tokenBalanceDecrease: asRawAmount(600n),
        reconciledRemainingAmount: asRawAmount(400n),
      }),
    );
    expect(decision.reconciled).toBe(true);
    expect(decision.closed).toBe(false);
    expect(decision.requiresContinuation).toBe(true);
    const opened = createReconciledPosition({
      id: positionId,
      tokenId: asUuid<TokenId>("00000000-0000-4000-8000-000000000094"),
      entryOrderId: asUuid<OrderId>("00000000-0000-4000-8000-000000000095"),
      acquiredAmount: asRawAmount(1_000n),
      costBasisSol: asNonNegativeDecimal(2),
      reconciledAt: at,
    });
    const pending = markExitPending(opened, asTimestamp("2026-08-04T12:00:00.500Z"));
    const updated = reconcileExit(
      pending,
      {
        soldAmount: decision.soldAmount!,
        proceedsSol: decision.proceedsSol!,
        reconciledRemainingAmount: decision.remainingAmount!,
        confirmedAt: asTimestamp("2026-08-04T12:00:01Z"),
      },
      "full",
    );
    expect(updated.state).toBe("partially_closed");
    expect(updated.currentAmount).toBe(400n);
  });

  it("closes only when authoritative reconciliation proves zero remaining balance", () => {
    const decision = evaluateSuccessfulExit(intent(), reconciliation());
    expect(decision.reconciled).toBe(true);
    expect(decision.closed).toBe(true);
    expect(decision.requiresContinuation).toBe(false);
    expect(decision.proceedsSol?.toString()).toBe("2");
  });
});
