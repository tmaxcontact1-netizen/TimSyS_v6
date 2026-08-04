import { describe, expect, it } from "vitest";

import {
  createPortfolioSnapshot,
  type PortfolioSnapshot,
} from "../../src/domain/portfolio/model.js";
import { evaluatePositionSize } from "../../src/domain/portfolio/sizing.js";
import {
  asNonNegativeDecimal,
  asDecimal,
  asPercentage,
  asSolanaSlot,
  asTimestamp,
  asUuid,
  type EvidenceId,
  type MintAddress,
} from "../../src/domain/shared/types.js";

const observedAt = asTimestamp("2026-08-04T12:00:00.000Z");
const evidence = Object.freeze([
  Object.freeze({
    id: asUuid<EvidenceId>("00000000-0000-4000-8000-000000000021"),
    provider: "solana_rpc" as const,
    observedAt,
    sourceKey: "wallet:portfolio",
    slot: asSolanaSlot(3n),
  }),
]);

const sol = asNonNegativeDecimal;

function valid(overrides: Partial<PortfolioSnapshot> = {}): PortfolioSnapshot {
  return createPortfolioSnapshot({
    observedAt,
    evidence,
    mint: "So11111111111111111111111111111111111111112" as MintAddress,
    equitySol: sol(100),
    uncommittedSol: sol(100),
    openCostExposureSol: sol(0),
    liquidityCapacitySol: sol(10),
    estimatedEntryCostsSol: sol("0.1"),
    openPositionCount: 0n,
    hasNonClosedPositionForMint: false,
    hasConfirmedPriorClosure: false,
    lastConfirmedClosureAt: null,
    usesLeverageOrBorrowing: false,
    increasesLosingPosition: false,
    requestedPositionPercentage: null,
    ...overrides,
  });
}

function outcome(snapshot: PortfolioSnapshot, id: string): string | undefined {
  return evaluatePositionSize(snapshot).results.find(({ ruleId }) => ruleId === id)?.outcome;
}

describe("portfolio snapshot", () => {
  it.each([
    ["equitySol", "-1"],
    ["uncommittedSol", "-1"],
    ["openCostExposureSol", "-1"],
    ["liquidityCapacitySol", "-1"],
    ["estimatedEntryCostsSol", "-1"],
  ] as const)("rejects negative %s", (field, value) => {
    expect(() => valid({ [field]: asDecimal(value) })).toThrow(
      `${field === "equitySol" ? "Equity" : "must be non-negative"}`,
    );
  });

  it("rejects impossible counts, reserve balances, and absent evidence", () => {
    expect(() => valid({ openPositionCount: -1n })).toThrow("Open position count");
    expect(() => valid({ uncommittedSol: sol(101) })).toThrow("cannot exceed equity");
    expect(() => valid({ evidence: [] })).toThrow("requires source evidence");
    expect(() =>
      valid({ hasConfirmedPriorClosure: false, lastConfirmedClosureAt: observedAt }),
    ).toThrow("timestamp requires");
    expect(() => valid({ hasConfirmedPriorClosure: true, lastConfirmedClosureAt: null })).toThrow(
      "requires its timestamp",
    );
  });

  it("freezes the snapshot and evidence collection", () => {
    const snapshot = valid();
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.evidence)).toBe(true);
  });
});

describe("deterministic position sizing", () => {
  it("passes ten rules and derives exact 0.5% loss and repeating risk size", () => {
    const decision = evaluatePositionSize(valid());
    expect(decision.eligible).toBe(true);
    expect(decision.results).toHaveLength(10);
    expect(decision.permittedLossSol?.toString()).toBe("0.5");
    expect(decision.riskDerivedSizeSol?.toString()).toBe("3.3333333333333333333");
    expect(decision.positionSizeSol?.toString()).toBe("3.3333333333333333333");
  });

  it.each([
    [2n, "pass"],
    [3n, "fail"],
  ])("applies the three-position limit at %s", (count, expected) => {
    expect(outcome(valid({ openPositionCount: count }), "UNI-005")).toBe(expected);
  });

  it("fails closed for unknown position count and mint state", () => {
    const decision = evaluatePositionSize(
      valid({ openPositionCount: null, hasNonClosedPositionForMint: null }),
    );
    expect(decision.failedRuleIds).toEqual(expect.arrayContaining(["UNI-005", "UNI-006"]));
  });

  it("rejects another non-closed position for the mint", () => {
    expect(outcome(valid({ hasNonClosedPositionForMint: true }), "UNI-006")).toBe("fail");
  });

  it.each([
    ["2026-08-04T06:00:00.001Z", "fail"],
    ["2026-08-04T06:00:00.000Z", "pass"],
    ["2026-08-04T05:59:59.999Z", "pass"],
  ])("applies the six-hour re-entry boundary for %s", (closedAt, expected) => {
    expect(
      outcome(
        valid({ hasConfirmedPriorClosure: true, lastConfirmedClosureAt: asTimestamp(closedAt) }),
        "UNI-007",
      ),
    ).toBe(expected);
  });

  it("fails re-entry closed when closure history is unknown", () => {
    expect(outcome(valid({ hasConfirmedPriorClosure: null }), "UNI-007")).toBe("fail");
  });

  it("selects each binding capacity without floating-point arithmetic", () => {
    expect(
      evaluatePositionSize(valid({ liquidityCapacitySol: sol(2) })).positionSizeSol?.toString(),
    ).toBe("2");
    expect(
      evaluatePositionSize(valid({ openCostExposureSol: sol(9) })).positionSizeSol?.toString(),
    ).toBe("1");
    expect(
      evaluatePositionSize(
        valid({ uncommittedSol: sol(52), estimatedEntryCostsSol: sol(1) }),
      ).positionSizeSol?.toString(),
    ).toBe("1");
  });

  it("fails when a requested size exceeds the calculated cap", () => {
    expect(
      outcome(valid({ requestedPositionPercentage: asPercentage("3.333334") }), "RSK-004"),
    ).toBe("fail");
    expect(
      outcome(
        valid({ requestedPositionPercentage: asPercentage("3.3333333333333333333") }),
        "RSK-004",
      ),
    ).toBe("pass");
  });

  it("passes the 10% exposure and 50% reserve boundaries inclusively", () => {
    const decision = evaluatePositionSize(
      valid({
        openCostExposureSol: sol("6.6666666666666666667"),
        uncommittedSol: sol("53.4333333333333333333"),
        estimatedEntryCostsSol: sol("0.1"),
      }),
    );
    expect(decision.positionSizeSol?.toString()).toBe("3.333333333333333333");
    expect(outcome(valid({ openCostExposureSol: sol("6.6666666666666666667") }), "RSK-005")).toBe(
      "pass",
    );
    expect(decision.results.find(({ ruleId }) => ruleId === "RSK-006")?.outcome).toBe("pass");
  });

  it("fails when no positive exposure or reserve capacity remains", () => {
    expect(outcome(valid({ openCostExposureSol: sol(10) }), "RSK-004")).toBe("fail");
    expect(
      outcome(valid({ uncommittedSol: sol(50), estimatedEntryCostsSol: sol("0.1") }), "RSK-006"),
    ).toBe("fail");
  });

  it.each([
    [{ usesLeverageOrBorrowing: true }, "leverage"],
    [{ increasesLosingPosition: true }, "losing position"],
    [{ usesLeverageOrBorrowing: null }, "unknown leverage state"],
    [{ increasesLosingPosition: null }, "unknown losing-position state"],
  ] as const)("fails RSK-007 for %s", (override, _description) => {
    expect(outcome(valid(override), "RSK-007")).toBe("fail");
  });

  it("fails closed when equity or required capacities are missing", () => {
    const decision = evaluatePositionSize(
      valid({
        equitySol: null,
        uncommittedSol: null,
        openCostExposureSol: null,
        liquidityCapacitySol: null,
        estimatedEntryCostsSol: null,
      }),
    );
    expect(decision.eligible).toBe(false);
    expect(decision.positionSizeSol).toBeNull();
    expect(decision.failedRuleIds).toEqual(
      expect.arrayContaining(["RSK-001", "RSK-003", "RSK-004", "RSK-005", "RSK-006"]),
    );
  });

  it("returns immutable decisions, results, and exact evidence", () => {
    const decision = evaluatePositionSize(valid());
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.results)).toBe(true);
    expect(Object.isFrozen(decision.failedRuleIds)).toBe(true);
    expect(
      decision.results.every((result) => result.evidence === decision.results[0]?.evidence),
    ).toBe(false);
    expect(
      decision.results.every((result) => result.evidence[0]?.sourceKey === "wallet:portfolio"),
    ).toBe(true);
  });
});
