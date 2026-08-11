import { describe, expect, it } from "vitest";

import {
  createEntryApproval,
  createEntryGateSnapshot,
  createExecutableQuote,
  evaluateEntryGate,
  type EntryGateSnapshot,
  type ExecutableQuote,
} from "../../src/domain/trading/quote.js";
import {
  asBasisPoints,
  asNonNegativeDecimal,
  asPercentage,
  asRawAmount,
  asSolanaSlot,
  asTimestamp,
  asUuid,
  type EvidenceId,
  type MintAddress,
} from "../../src/domain/shared/types.js";

const solMint = "So11111111111111111111111111111111111111112" as MintAddress;
const tokenMint = "11111111111111111111111111111111" as MintAddress;
const receivedAt = asTimestamp("2026-08-04T12:00:00.000Z");
const evidence = Object.freeze([
  Object.freeze({
    id: asUuid<EvidenceId>("00000000-0000-4000-8000-000000000031"),
    provider: "jupiter" as const,
    observedAt: receivedAt,
    sourceKey: "quote:entry",
    slot: asSolanaSlot(100n),
  }),
]);

function quote(overrides: Partial<ExecutableQuote> = {}): ExecutableQuote {
  return createExecutableQuote({
    fingerprint: "entry-v1",
    inputMint: solMint,
    outputMint: tokenMint,
    inputAmount: asRawAmount(1_000_000_000n),
    expectedOutputAmount: asRawAmount(10_000_000n),
    minimumOutputAmount: asRawAmount(9_850_000n),
    slippageBasisPoints: asBasisPoints(150n),
    priceImpactPercentage: asPercentage(2),
    routePlan: ["pool-a"],
    contextSlot: asSolanaSlot(100n),
    requestedAt: asTimestamp("2026-08-04T11:59:59.900Z"),
    receivedAt,
    evidence,
    ...overrides,
  });
}

function reverse(overrides: Partial<ExecutableQuote> = {}): ExecutableQuote {
  return quote({
    fingerprint: "reverse-v1",
    inputMint: tokenMint,
    outputMint: solMint,
    inputAmount: asRawAmount(10_000_000n),
    expectedOutputAmount: asRawAmount(950_000_000n),
    minimumOutputAmount: asRawAmount(935_750_000n),
    priceImpactPercentage: asPercentage(3),
    evidence: Object.freeze([{ ...evidence[0]!, sourceKey: "quote:reverse" }]),
    ...overrides,
  });
}

function valid(overrides: Partial<EntryGateSnapshot> = {}): EntryGateSnapshot {
  const entryQuote = overrides.entryQuote === undefined ? quote() : overrides.entryQuote;
  const evaluatedAt = overrides.evaluatedAt ?? asTimestamp("2026-08-04T12:00:02.000Z");
  const approval = createEntryApproval({
    issuedAt: asTimestamp("2026-08-04T12:00:00.000Z"),
    eligibilityHash: "eligible-v1",
    quoteFingerprint: "entry-v1",
  });
  return createEntryGateSnapshot({
    stage: "signing",
    evaluatedAt,
    entryQuote,
    reverseQuote: reverse(),
    positionValueSol: asNonNegativeDecimal(1),
    estimatedExecutionCostsSol: asNonNegativeDecimal("0.01"),
    simulation: {
      succeeded: true,
      contextSlot: asSolanaSlot(100n),
      quoteFingerprint: "entry-v1",
    },
    finalRecalculation: {
      securityRulesPassed: true,
      exposureRulesPassed: true,
      quoteFingerprint: "entry-v1",
    },
    approval,
    currentEligibilityHash: "eligible-v1",
    submissionFailed: false,
    ...overrides,
  });
}

function outcome(snapshot: EntryGateSnapshot, id: string): string | undefined {
  return evaluateEntryGate(snapshot).results.find(({ ruleId }) => ruleId === id)?.outcome;
}

describe("executable quote", () => {
  it("normalizes and freezes a structurally valid quote", () => {
    const value = quote();
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value.routePlan)).toBe(true);
    expect(Object.isFrozen(value.evidence)).toBe(true);
  });

  it.each([
    [{ fingerprint: "" }, "fingerprint"],
    [{ outputMint: solMint }, "mints must differ"],
    [{ inputAmount: asRawAmount(0n) }, "amounts must be positive"],
    [{ expectedOutputAmount: asRawAmount(0n) }, "amounts must be positive"],
    [{ minimumOutputAmount: asRawAmount(0n) }, "minimum output"],
    [{ minimumOutputAmount: asRawAmount(10_000_001n) }, "minimum output"],
    [{ routePlan: [] }, "route plan"],
    [{ evidence: [] }, "source evidence"],
    [{ requestedAt: asTimestamp("2026-08-04T12:00:00.001Z") }, "before it was requested"],
  ] as const)("rejects malformed quote input %#", (override, message) => {
    expect(() => quote(override)).toThrow(message);
  });

  it("derives an approval expiry exactly fifteen seconds after issue", () => {
    expect(
      createEntryApproval({
        issuedAt: receivedAt,
        eligibilityHash: "hash",
        quoteFingerprint: "quote",
      }).expiresAt,
    ).toBe("2026-08-04T12:00:15.000Z");
  });

  it("rejects negative financial gate facts", () => {
    expect(() => valid({ positionValueSol: asNonNegativeDecimal(0).minus(1) as never })).toThrow(
      "Position value",
    );
    expect(() =>
      valid({ estimatedExecutionCostsSol: asNonNegativeDecimal(0).minus(1) as never }),
    ).toThrow("execution costs");
  });

  it("rejects a persisted approval that bypasses the fixed lifetime", () => {
    expect(() =>
      valid({
        approval: {
          issuedAt: receivedAt,
          expiresAt: asTimestamp("2026-08-04T12:00:15.001Z"),
          eligibilityHash: "eligible-v1",
          quoteFingerprint: "entry-v1",
        },
      }),
    ).toThrow("fifteen seconds");
  });
});

describe("deterministic entry gate", () => {
  it("passes all ten rules at every inclusive maximum", () => {
    const decision = evaluateEntryGate(valid());
    expect(decision.eligible).toBe(true);
    expect(decision.results).toHaveLength(10);
    expect(decision.quoteAgeMilliseconds).toBe(2000n);
    expect(decision.expectedRoundTripLossPercentage?.toString()).toBe("5");
    expect(decision.executionCostPercentage?.toString()).toBe("1");
  });

  it.each([
    ["2026-08-04T12:00:01.999Z", "pass"],
    ["2026-08-04T12:00:02.000Z", "pass"],
    ["2026-08-04T12:00:02.001Z", "fail"],
    ["2026-08-04T11:59:59.999Z", "fail"],
  ])("applies the two-second freshness boundary at %s", (time, expected) => {
    expect(outcome(valid({ evaluatedAt: asTimestamp(time) }), "ENT-001")).toBe(expected);
  });

  it.each([
    ["1.999999", "pass"],
    ["2", "pass"],
    ["2.000001", "fail"],
  ])("applies the entry impact boundary at %s%%", (impact, expected) => {
    expect(
      outcome(
        valid({ entryQuote: quote({ priceImpactPercentage: asPercentage(impact) }) }),
        "ENT-002",
      ),
    ).toBe(expected);
  });

  it("requires an exact 150 basis-point slippage tolerance", () => {
    expect(
      outcome(
        valid({ entryQuote: quote({ slippageBasisPoints: asBasisPoints(149n) }) }),
        "ENT-003",
      ),
    ).toBe("fail");
    expect(
      outcome(
        valid({ entryQuote: quote({ slippageBasisPoints: asBasisPoints(151n) }) }),
        "ENT-003",
      ),
    ).toBe("fail");
  });

  it.each([
    ["2.999999", "pass"],
    ["3", "pass"],
    ["3.000001", "fail"],
  ])("applies the reverse impact boundary at %s%%", (impact, expected) => {
    expect(
      outcome(
        valid({ reverseQuote: reverse({ priceImpactPercentage: asPercentage(impact) }) }),
        "ENT-004",
      ),
    ).toBe(expected);
  });

  it("requires the reverse route to cover all expected output in the opposite direction", () => {
    expect(
      outcome(
        valid({ reverseQuote: reverse({ inputAmount: asRawAmount(9_999_999n) }) }),
        "ENT-004",
      ),
    ).toBe("fail");
    expect(
      outcome(
        valid({ reverseQuote: reverse({ inputMint: solMint, outputMint: tokenMint }) }),
        "ENT-004",
      ),
    ).toBe("fail");
  });

  it.each([
    [950_000_001n, "pass"],
    [950_000_000n, "pass"],
    [949_999_999n, "fail"],
    [1_000_000_001n, "fail"],
  ])("applies the round-trip loss boundary to reverse output %s", (amount, expected) => {
    expect(
      outcome(
        valid({
          reverseQuote: reverse({
            expectedOutputAmount: asRawAmount(amount),
            minimumOutputAmount: asRawAmount(900_000_000n),
          }),
        }),
        "ENT-005",
      ),
    ).toBe(expected);
  });

  it.each([
    ["0.00999999", "pass"],
    ["0.01", "pass"],
    ["0.01000001", "fail"],
  ])("applies the 1%% execution-cost boundary at %s SOL", (cost, expected) => {
    expect(
      outcome(valid({ estimatedExecutionCostsSol: asNonNegativeDecimal(cost) }), "ENT-006"),
    ).toBe(expected);
  });

  it.each([
    [{ simulation: null }, "missing"],
    [
      {
        simulation: {
          succeeded: false,
          contextSlot: asSolanaSlot(100n),
          quoteFingerprint: "entry-v1",
        },
      },
      "failed",
    ],
    [
      {
        simulation: {
          succeeded: true,
          contextSlot: asSolanaSlot(99n),
          quoteFingerprint: "entry-v1",
        },
      },
      "stale context",
    ],
    [
      {
        simulation: { succeeded: true, contextSlot: asSolanaSlot(100n), quoteFingerprint: "other" },
      },
      "quote mismatch",
    ],
  ] as const)("fails simulation for $1", (override, _description) => {
    expect(outcome(valid(override), "ENT-007")).toBe("fail");
  });

  it.each([
    [{ finalRecalculation: null }, "missing"],
    [
      {
        finalRecalculation: {
          securityRulesPassed: false,
          exposureRulesPassed: true,
          quoteFingerprint: "entry-v1",
        },
      },
      "security",
    ],
    [
      {
        finalRecalculation: {
          securityRulesPassed: true,
          exposureRulesPassed: false,
          quoteFingerprint: "entry-v1",
        },
      },
      "exposure",
    ],
    [
      {
        finalRecalculation: {
          securityRulesPassed: true,
          exposureRulesPassed: true,
          quoteFingerprint: "other",
        },
      },
      "quote mismatch",
    ],
  ] as const)("fails final recalculation for $1", (override, _description) => {
    expect(outcome(valid(override), "ENT-008")).toBe("fail");
  });

  it("binds approval to the quote, eligibility hash, and inclusive fifteen-second lifetime", () => {
    expect(
      outcome(valid({ evaluatedAt: asTimestamp("2026-08-04T12:00:15.000Z") }), "ENT-009"),
    ).toBe("pass");
    expect(
      outcome(valid({ evaluatedAt: asTimestamp("2026-08-04T12:00:15.001Z") }), "ENT-009"),
    ).toBe("fail");
    expect(outcome(valid({ currentEligibilityHash: "changed" }), "ENT-009")).toBe("fail");
    expect(outcome(valid({ approval: null }), "ENT-009")).toBe("fail");
  });

  it("requires renewal after any failed gate, unknown submission state, or failed submission", () => {
    const changedQuote = evaluateEntryGate(
      valid({ entryQuote: quote({ fingerprint: "changed" }) }),
    );
    expect(changedQuote.requiresNewQuoteAndEvaluation).toBe(true);
    expect(changedQuote.failedRuleIds).toContain("ENT-010");
    expect(outcome(valid({ submissionFailed: null }), "ENT-010")).toBe("fail");
    expect(outcome(valid({ submissionFailed: true }), "ENT-010")).toBe("fail");
  });

  it("fails closed when quote and financial facts are missing", () => {
    const decision = evaluateEntryGate(
      valid({
        entryQuote: null,
        reverseQuote: null,
        positionValueSol: null,
        estimatedExecutionCostsSol: null,
        simulation: null,
        finalRecalculation: null,
        approval: null,
        currentEligibilityHash: null,
        submissionFailed: null,
      }),
    );
    expect(decision.eligible).toBe(false);
    expect(decision.failedRuleIds).toEqual([
      "ENT-001",
      "ENT-002",
      "ENT-003",
      "ENT-004",
      "ENT-005",
      "ENT-006",
      "ENT-007",
      "ENT-008",
      "ENT-009",
      "ENT-010",
    ]);
  });

  it("returns immutable decisions, results, measurements, and source evidence", () => {
    const decision = evaluateEntryGate(valid());
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.results)).toBe(true);
    expect(Object.isFrozen(decision.failedRuleIds)).toBe(true);
    expect(decision.results.every((item) => item.evidence.length === 2)).toBe(true);
    expect(decision.results.every((item) => Object.isFrozen(item.measurements))).toBe(true);
  });
});
