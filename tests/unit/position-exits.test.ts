import { describe, expect, it } from "vitest";

import { evaluateExit, type ExitSnapshot } from "../../src/domain/trading/exits.js";
import {
  createReconciledPosition,
  markExitPending,
  recordExecutablePeak,
  reconcileExit,
  restorePosition,
  type Position,
} from "../../src/domain/trading/position.js";
import {
  asNonNegativeDecimal,
  asRawAmount,
  asSolanaSlot,
  asTimestamp,
  asUuid,
  type EvidenceId,
  type OrderId,
  type PositionId,
  type TokenId,
} from "../../src/domain/shared/types.js";

const openedAt = asTimestamp("2026-08-04T12:00:00.000Z");
const evidence = Object.freeze([
  Object.freeze({
    id: asUuid<EvidenceId>("00000000-0000-4000-8000-000000000051"),
    provider: "jupiter" as const,
    observedAt: openedAt,
    sourceKey: "exit:quote-1",
    slot: asSolanaSlot(300n),
  }),
]);

function position(): Position {
  return createReconciledPosition({
    id: asUuid<PositionId>("00000000-0000-4000-8000-000000000052"),
    tokenId: asUuid<TokenId>("00000000-0000-4000-8000-000000000053"),
    entryOrderId: asUuid<OrderId>("00000000-0000-4000-8000-000000000054"),
    acquiredAmount: asRawAmount(1_000n),
    costBasisSol: asNonNegativeDecimal(10),
    reconciledAt: openedAt,
  });
}

function snapshot(
  value: string | null,
  at = "2026-08-04T12:01:00.000Z",
  emergencyExit = false,
): ExitSnapshot {
  return {
    evaluatedAt: asTimestamp(at),
    executableValueSol: value === null ? null : asNonNegativeDecimal(value),
    emergencyExit,
    evidence,
  };
}

function partial(
  p: Position,
  target: "first" | "second",
  sold: bigint,
  proceeds: string,
  at: string,
): Position {
  return reconcileExit(
    markExitPending(p, asTimestamp(at)),
    {
      soldAmount: asRawAmount(sold),
      proceedsSol: asNonNegativeDecimal(proceeds),
      reconciledRemainingAmount: asRawAmount(p.currentAmount - sold),
      confirmedAt: asTimestamp(new Date(Date.parse(at) + 1)),
    },
    target,
  );
}

describe("position lifecycle", () => {
  it("opens only from positive reconciled quantity and cost and freezes the aggregate", () => {
    const value = position();
    expect(value.state).toBe("open");
    expect(value.currentAmount).toBe(1_000n);
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value.lots)).toBe(true);
  });

  it("tracks a monotonic executable peak", () => {
    const high = recordExecutablePeak(
      position(),
      asNonNegativeDecimal(14),
      asTimestamp("2026-08-04T12:01:00Z"),
    );
    const low = recordExecutablePeak(
      high,
      asNonNegativeDecimal(12),
      asTimestamp("2026-08-04T12:02:00Z"),
    );
    expect(low.peakExecutableValueSol.toString()).toBe("14");
  });

  it("restores valid persisted state and rejects inconsistent restart snapshots", () => {
    const value = restorePosition(position());
    expect(value.state).toBe("open");
    expect(Object.isFrozen(value.lots[0])).toBe(true);
    expect(() => restorePosition({ ...value, currentAmount: asRawAmount(999n) })).toThrow(
      "lot quantities",
    );
    expect(() => restorePosition({ ...value, state: "closed", closedAt: openedAt })).toThrow(
      "zero balance",
    );
    expect(() =>
      restorePosition({ ...value, firstTargetSatisfied: false, secondTargetSatisfied: true }),
    ).toThrow("Second target");
  });

  it("accounts for a partial exit using proportional remaining cost", () => {
    const value = partial(position(), "first", 400n, "5", "2026-08-04T12:01:00Z");
    expect(value.state).toBe("partially_closed");
    expect(value.currentAmount).toBe(600n);
    expect(value.remainingCostBasisSol.toString()).toBe("6");
    expect(value.realisedPnlSol.toString()).toBe("1");
    expect(value.firstTargetSatisfied).toBe(true);
  });

  it("does not mark a full exit closed without reconciled zero balance", () => {
    const pending = markExitPending(position(), asTimestamp("2026-08-04T12:01:00Z"));
    expect(() =>
      reconcileExit(
        pending,
        {
          soldAmount: asRawAmount(900n),
          proceedsSol: asNonNegativeDecimal(9),
          reconciledRemainingAmount: asRawAmount(100n),
          confirmedAt: asTimestamp("2026-08-04T12:01:01Z"),
        },
        "full",
      ),
    ).toThrow("zero balance");
  });

  it("closes only after authoritative zero-balance reconciliation", () => {
    const pending = markExitPending(position(), asTimestamp("2026-08-04T12:01:00Z"));
    const value = reconcileExit(
      pending,
      {
        soldAmount: asRawAmount(1_000n),
        proceedsSol: asNonNegativeDecimal(12),
        reconciledRemainingAmount: asRawAmount(0n),
        confirmedAt: asTimestamp("2026-08-04T12:01:01Z"),
      },
      "full",
    );
    expect(value.state).toBe("closed");
    expect(value.realisedPnlSol.toString()).toBe("2");
    expect(value.closedAt).not.toBeNull();
  });
});

describe("standard exit decisions", () => {
  it.each([
    ["8.5", "full"],
    ["8.500001", "none"],
  ] as const)("applies the inclusive 15%% hard stop at %s", (value, action) => {
    expect(evaluateExit(position(), snapshot(value)).action).toBe(action);
  });

  it("requests 40% of original quantity at +25% exactly", () => {
    const decision = evaluateExit(position(), snapshot("12.5"));
    expect(decision.ruleId).toBe("EXT-002");
    expect(decision.requestedAmount).toBe(400n);
  });

  it("prioritises the highest unsatisfied target when both fire", () => {
    const decision = evaluateExit(position(), snapshot("15"));
    expect(decision.ruleId).toBe("EXT-003");
    expect(decision.requestedAmount).toBe(300n);
  });

  it("never repeats a satisfied original-quantity tranche", () => {
    const once = partial(position(), "first", 400n, "5", "2026-08-04T12:01:00Z");
    expect(evaluateExit(once, snapshot("9", "2026-08-04T12:02:00Z")).ruleId).toBe("EXT-003");
  });

  it("activates the 15% trailing exit only after the first target", () => {
    const once = partial(position(), "first", 400n, "5", "2026-08-04T12:01:00Z");
    const peaked = recordExecutablePeak(
      once,
      asNonNegativeDecimal(8),
      asTimestamp("2026-08-04T12:02:00Z"),
    );
    expect(evaluateExit(peaked, snapshot("6.8", "2026-08-04T12:03:00Z")).ruleId).toBe("EXT-004");
    expect(evaluateExit(position(), snapshot("8.5")).ruleId).toBe("EXT-001");
  });

  it.each([
    ["2026-08-04T17:59:59.999Z", null],
    ["2026-08-04T18:00:00.000Z", "EXT-005"],
    ["2026-08-05T12:00:00.000Z", "EXT-006"],
  ] as const)("applies timed exit boundary %s", (at, rule) => {
    expect(evaluateExit(position(), snapshot("10.9", at)).ruleId).toBe(rule);
  });

  it("gives emergency and full exits priority and fails closed without executable value", () => {
    expect(evaluateExit(position(), snapshot("15", undefined, true)).ruleId).toBe("EMERGENCY");
    expect(evaluateExit(position(), snapshot(null)).action).toBe("none");
  });

  it("requires evidence and active reconciled state", () => {
    expect(() => evaluateExit(position(), { ...snapshot("12"), evidence: [] })).toThrow("evidence");
    const pending = markExitPending(position(), asTimestamp("2026-08-04T12:01:00Z"));
    expect(() => evaluateExit(pending, snapshot("12", "2026-08-04T12:02:00Z"))).toThrow("active");
  });
});
