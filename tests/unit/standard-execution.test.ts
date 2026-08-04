import { describe, expect, it } from "vitest";

import {
  createStandardExitIntent,
  evaluateSuccessfulExit,
  type ExitReconciliation,
} from "../../src/domain/trading/order.js";
import {
  asNonNegativeDecimal,
  asRawAmount,
  asTimestamp,
  asUuid,
  type EvidenceId,
  type OrderId,
  type PositionId,
} from "../../src/domain/shared/types.js";
import type { ExitDecision } from "../../src/domain/trading/exits.js";

const at = asTimestamp("2026-08-04T13:00:00Z");
const positionId = asUuid<PositionId>("00000000-0000-4000-8000-000000000101");
const evidence = Object.freeze([
  {
    id: asUuid<EvidenceId>("00000000-0000-4000-8000-000000000102"),
    provider: "jupiter" as const,
    observedAt: at,
    sourceKey: "standard-exit:q1",
  },
]);

function decision(
  ruleId = "EXT-002",
  action: "partial" | "full" = "partial",
  requested = 400n,
): ExitDecision {
  return Object.freeze({
    action,
    ruleId,
    requestedAmount: asRawAmount(requested),
    results: Object.freeze([]),
  });
}

function intent(overrides: Record<string, unknown> = {}) {
  return createStandardExitIntent({
    orderId: asUuid<OrderId>("00000000-0000-4000-8000-000000000103"),
    positionId,
    positionVersion: 5n,
    currentAmount: asRawAmount(1_000n),
    originalAmount: asRawAmount(1_000n),
    decision: decision(),
    quoteFingerprint: "sell-q1",
    evidence,
    quoteReceivedAt: asTimestamp("2026-08-04T12:59:58Z"),
    sellRouteValid: true,
    simulationSucceeded: true,
    createdAt: at,
    ...overrides,
  });
}

function reconciliation(overrides: Partial<ExitReconciliation> = {}): ExitReconciliation {
  return {
    evaluatedAt: asTimestamp("2026-08-04T13:00:01Z"),
    transactionConfirmed: true,
    onChainError: false,
    tokenBalanceDecrease: asRawAmount(400n),
    reconciledRemainingAmount: asRawAmount(600n),
    solBalanceIncrease: asRawAmount(5_000_000_000n),
    feePaid: asRawAmount(5_000n),
    tipPaid: asRawAmount(1_000n),
    signature: "sig-1",
    expectedSignature: "sig-1",
    evidence,
    ...overrides,
  };
}

describe("standard exit execution", () => {
  it("binds a profit tranche to the exact position version, rule, amount, quote, and evidence", () => {
    const value = intent();
    expect(value.standardRuleId).toBe("EXT-002");
    expect(value.requestedAmount).toBe(400n);
    expect(value.order.idempotencyKey).toContain(`${positionId}:5:EXT-002:400`);
    expect(Object.isFrozen(value)).toBe(true);
  });

  it.each([
    ["2026-08-04T12:59:58.000Z", true],
    ["2026-08-04T12:59:57.999Z", false],
    ["2026-08-04T13:00:00.001Z", false],
  ] as const)("evaluates quote timestamp %s", (receivedAt, valid) => {
    const create = () => intent({ quoteReceivedAt: asTimestamp(receivedAt) });
    if (valid) expect(create().order.side).toBe("sell");
    else expect(create).toThrow("fresh valid simulated");
  });

  it.each(["sellRouteValid", "simulationSucceeded"] as const)("rejects a false %s", (field) => {
    expect(() => intent({ [field]: false })).toThrow("fresh valid simulated");
  });

  it("rejects forged rule, action, and tranche amount combinations", () => {
    expect(() => intent({ decision: decision("EMG-001") })).toThrow("EXT rule");
    expect(() => intent({ decision: decision("EXT-002", "full") })).toThrow("match");
    expect(() => intent({ decision: decision("EXT-003", "partial", 400n) })).toThrow("match");
  });

  it("binds every full standard rule to the entire current amount", () => {
    for (const ruleId of ["EXT-001", "EXT-004", "EXT-005", "EXT-006"]) {
      expect(intent({ decision: decision(ruleId, "full", 1_000n) }).requestedAmount).toBe(1_000n);
    }
  });

  it("caps an original-quantity tranche at the actual remaining position", () => {
    const value = intent({
      currentAmount: asRawAmount(200n),
      decision: decision("EXT-003", "partial", 200n),
    });
    expect(value.requestedAmount).toBe(200n);
  });

  it("reconciles a completed partial target without requiring continuation", () => {
    const result = evaluateSuccessfulExit(intent(), reconciliation());
    expect(result.reconciled).toBe(true);
    expect(result.closed).toBe(false);
    expect(result.requestedAmountSatisfied).toBe(true);
    expect(result.requiresContinuation).toBe(false);
  });

  it("continues the same target after a reconciled partial fill", () => {
    const result = evaluateSuccessfulExit(
      intent(),
      reconciliation({
        tokenBalanceDecrease: asRawAmount(150n),
        reconciledRemainingAmount: asRawAmount(850n),
      }),
    );
    expect(result.reconciled).toBe(true);
    expect(result.requestedAmountSatisfied).toBe(false);
    expect(result.requiresContinuation).toBe(true);
  });

  it("fails closed on a signature mismatch or impossible authoritative remaining balance", () => {
    expect(
      evaluateSuccessfulExit(intent(), reconciliation({ signature: "other" })).reconciled,
    ).toBe(false);
    expect(
      evaluateSuccessfulExit(
        intent(),
        reconciliation({ reconciledRemainingAmount: asRawAmount(599n) }),
      ).reconciled,
    ).toBe(false);
  });

  it("closes a full standard exit only at authoritative zero balance", () => {
    const full = intent({ decision: decision("EXT-006", "full", 1_000n) });
    const result = evaluateSuccessfulExit(
      full,
      reconciliation({
        tokenBalanceDecrease: asRawAmount(1_000n),
        reconciledRemainingAmount: asRawAmount(0n),
      }),
    );
    expect(result.closed).toBe(true);
    expect(result.requestedAmountSatisfied).toBe(true);
    expect(result.proceedsSol?.equals(asNonNegativeDecimal(5))).toBe(true);
  });
});
