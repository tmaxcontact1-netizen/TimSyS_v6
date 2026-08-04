import { describe, expect, it } from "vitest";

import {
  createOrder,
  createSubmissionAttempt,
  evaluateSuccessfulEntry,
  markAttemptConfirmed,
  markAttemptFailed,
  markAttemptSubmitted,
  orderStateMachine,
  transitionOrder,
  type EntryReconciliation,
  type Order,
  type SubmissionAttempt,
} from "../../src/domain/trading/order.js";
import {
  asRawAmount,
  asSolanaSlot,
  asTimestamp,
  asUuid,
  type EvidenceId,
  type OrderId,
} from "../../src/domain/shared/types.js";

const createdAt = asTimestamp("2026-08-04T12:00:00.000Z");
const orderId = asUuid<OrderId>("00000000-0000-4000-8000-000000000041");
const evidence = Object.freeze([
  Object.freeze({
    id: asUuid<EvidenceId>("00000000-0000-4000-8000-000000000042"),
    provider: "solana_rpc" as const,
    observedAt: asTimestamp("2026-08-04T12:00:10.000Z"),
    sourceKey: "transaction:signature-1",
    slot: asSolanaSlot(200n),
  }),
]);

function order(overrides: Partial<Order> = {}): Order {
  return createOrder({
    id: orderId,
    side: "buy",
    state: "planned",
    intendedInputAmount: asRawAmount(1_000_000_000n),
    quoteFingerprint: "quote-v1",
    idempotencyKey: "entry:signal-1:quote-v1",
    createdAt,
    updatedAt: createdAt,
    version: 0n,
    ...overrides,
  });
}

function signingOrder(): Order {
  return order({ state: "signing", version: 4n });
}

function reconciliation(overrides: Partial<EntryReconciliation> = {}): EntryReconciliation {
  return {
    evaluatedAt: asTimestamp("2026-08-04T12:00:10.000Z"),
    transactionConfirmed: true,
    onChainError: false,
    tokenBalanceIncrease: asRawAmount(10_000_000n),
    solBalanceDecrease: asRawAmount(1_000_000_000n),
    feePaid: asRawAmount(5_000n),
    tipPaid: asRawAmount(1_000n),
    minimumOutputAmount: asRawAmount(9_850_000n),
    signature: "signature-1",
    evidence,
    ...overrides,
  };
}

function attempt(): SubmissionAttempt {
  return createSubmissionAttempt(signingOrder(), [], "primary", createdAt);
}

describe("order state machine", () => {
  it("accepts the complete successful lifecycle", () => {
    let value = order();
    for (const [index, state] of (
      [
        "quoted",
        "simulated",
        "approved",
        "signing",
        "submitted",
        "confirming",
        "confirmed",
        "reconciled",
      ] as const
    ).entries()) {
      value = transitionOrder(
        value,
        state,
        asTimestamp(new Date(Date.parse(createdAt) + index + 1)),
      );
    }
    expect(value.state).toBe("reconciled");
    expect(value.version).toBe(8n);
  });

  it.each(["planned", "quoted", "simulated", "approved"] as const)(
    "allows cancellation from pre-submission state %s",
    (state) => expect(orderStateMachine.canTransition(state, "cancelled")).toBe(true),
  );

  it("rejects skipping gates and terminal-state mutation", () => {
    expect(() => transitionOrder(order(), "approved", createdAt)).toThrow("not allowed");
    expect(() => transitionOrder(order({ state: "reconciled" }), "failed", createdAt)).toThrow(
      "not allowed",
    );
    expect(() => transitionOrder(order({ state: "cancelled" }), "planned", createdAt)).toThrow(
      "not allowed",
    );
  });

  it("permits retry only by returning a failed order to signing", () => {
    expect(transitionOrder(order({ state: "failed" }), "signing", createdAt).state).toBe("signing");
    expect(orderStateMachine.canTransition("failed", "submitted")).toBe(false);
  });

  it("increments version, freezes output, and rejects backwards time", () => {
    const value = transitionOrder(order(), "quoted", asTimestamp("2026-08-04T12:00:00.001Z"));
    expect(value.version).toBe(1n);
    expect(Object.isFrozen(value)).toBe(true);
    expect(() =>
      transitionOrder(value, "simulated", asTimestamp("2026-08-03T00:00:00.000Z")),
    ).toThrow("backwards");
  });

  it.each([
    [{ intendedInputAmount: asRawAmount(0n) }, "positive"],
    [{ quoteFingerprint: "" }, "fingerprint"],
    [{ idempotencyKey: "" }, "idempotency"],
    [{ version: -1n }, "version"],
  ] as const)("rejects malformed order %#", (override, message) => {
    expect(() => order(override)).toThrow(message);
  });
});

describe("submission attempts", () => {
  it("creates a frozen first attempt bound to the order identity and intent", () => {
    const value = attempt();
    expect(value.attemptNumber).toBe(1n);
    expect(value.quoteFingerprint).toBe("quote-v1");
    expect(value.intendedInputAmount).toBe(1_000_000_000n);
    expect(Object.isFrozen(value)).toBe(true);
  });

  it("records submission and confirmation without treating acknowledgement as execution", () => {
    const submitted = markAttemptSubmitted(
      attempt(),
      "signature-1",
      asTimestamp("2026-08-04T12:00:01.000Z"),
    );
    expect(submitted.state).toBe("submitted");
    expect(submitted.confirmedAt).toBeNull();
    const confirmed = markAttemptConfirmed(submitted, asTimestamp("2026-08-04T12:00:02.000Z"));
    expect(confirmed.state).toBe("confirmed");
  });

  it("creates a sequential retry only after every prior attempt failed", () => {
    const first = markAttemptFailed(attempt(), "RPC_TIMEOUT");
    const second = createSubmissionAttempt(signingOrder(), [first], "fallback", createdAt);
    expect(second.attemptNumber).toBe(2n);
    expect(second.orderId).toBe(first.orderId);
    expect(second.quoteFingerprint).toBe(first.quoteFingerprint);
  });

  it("rejects retries after a live attempt and rejects malformed attempt history", () => {
    expect(() =>
      createSubmissionAttempt(signingOrder(), [attempt()], "fallback", createdAt),
    ).toThrow("failed submission");
    expect(() =>
      createSubmissionAttempt(
        signingOrder(),
        [{ ...markAttemptFailed(attempt(), "X"), attemptNumber: 2n }],
        "fallback",
        createdAt,
      ),
    ).toThrow("contiguous");
  });

  it("rejects invalid attempt transitions and timestamps", () => {
    expect(() => markAttemptConfirmed(attempt(), createdAt)).toThrow("submitted");
    expect(() => markAttemptSubmitted(attempt(), "", createdAt)).toThrow("signature");
    expect(() =>
      markAttemptSubmitted(attempt(), "signature", asTimestamp("2026-08-03T00:00:00.000Z")),
    ).toThrow("precede");
    expect(() => markAttemptFailed(markAttemptFailed(attempt(), "X"), "Y")).toThrow("Terminal");
  });
});

describe("successful entry reconciliation", () => {
  it("passes EXE-001 through EXE-006 using authoritative reconciled facts", () => {
    const decision = evaluateSuccessfulEntry(reconciliation());
    expect(decision.successfulEntry).toBe(true);
    expect(decision.results).toHaveLength(6);
    expect(decision.failedRuleIds).toEqual([]);
    expect(decision.realisedEntryPrice?.toString()).toBe("100");
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.results)).toBe(true);
  });

  it.each([
    [{ transactionConfirmed: null }, "EXE-001"],
    [{ transactionConfirmed: false }, "EXE-001"],
    [{ onChainError: true }, "EXE-001"],
    [{ onChainError: null }, "EXE-001"],
    [{ tokenBalanceIncrease: null }, "EXE-002"],
    [{ tokenBalanceIncrease: asRawAmount(0n) }, "EXE-002"],
    [{ solBalanceDecrease: null }, "EXE-002"],
    [{ solBalanceDecrease: asRawAmount(0n) }, "EXE-002"],
    [{ feePaid: null }, "EXE-003"],
    [{ tipPaid: null }, "EXE-003"],
    [{ signature: null }, "EXE-006"],
  ] as const)("fails closed for missing or unsafe execution fact %#", (override, id) => {
    const decision = evaluateSuccessfulEntry(reconciliation(override));
    expect(decision.successfulEntry).toBe(false);
    expect(decision.failedRuleIds).toContain(id);
    expect(decision.failedRuleIds).toContain("EXE-006");
  });

  it.each([
    [9_849_999n, "fail"],
    [9_850_000n, "pass"],
    [9_850_001n, "pass"],
  ])("applies minimum output boundary at %s", (received, expected) => {
    const result = evaluateSuccessfulEntry(
      reconciliation({ tokenBalanceIncrease: asRawAmount(received) }),
    ).results.find(({ ruleId }) => ruleId === "EXE-005");
    expect(result?.outcome).toBe(expected);
  });

  it("does not treat a confirmed signature without balance facts as success", () => {
    const decision = evaluateSuccessfulEntry(
      reconciliation({ tokenBalanceIncrease: null, solBalanceDecrease: null }),
    );
    expect(decision.successfulEntry).toBe(false);
    expect(decision.failedRuleIds).toEqual(["EXE-002", "EXE-003", "EXE-004", "EXE-005", "EXE-006"]);
  });

  it("requires a positive minimum and evidence", () => {
    expect(() =>
      evaluateSuccessfulEntry(reconciliation({ minimumOutputAmount: asRawAmount(0n) })),
    ).toThrow("positive");
    expect(() => evaluateSuccessfulEntry(reconciliation({ evidence: [] }))).toThrow("evidence");
  });
});
