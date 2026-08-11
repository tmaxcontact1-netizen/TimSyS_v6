import { describe, expect, it } from "vitest";

import { asMintAddress, createToken } from "../../src/domain/token/token.js";
import {
  evaluateTokenSecurity,
  type TokenSecuritySnapshot,
} from "../../src/domain/token/security.js";
import {
  asPercentage,
  asSolanaSlot,
  asTimestamp,
  asUuid,
  type EvidenceId,
  type TokenId,
} from "../../src/domain/shared/types.js";

const observedAt = asTimestamp("2026-08-04T00:00:00.000Z");
const evidence = Object.freeze([
  Object.freeze({
    id: asUuid<EvidenceId>("00000000-0000-4000-8000-000000000001"),
    provider: "solana_rpc" as const,
    observedAt,
    sourceKey: "mint:So11111111111111111111111111111111111111112",
    slot: asSolanaSlot(1n),
  }),
]);

function safeSnapshot(overrides: Partial<TokenSecuritySnapshot> = {}): TokenSecuritySnapshot {
  return {
    observedAt,
    evidence,
    directlyVerifiedOnChain: true,
    program: "spl_token",
    mintAuthority: "revoked",
    freezeAuthority: "revoked",
    extensions: [],
    extensionsVerified: true,
    holders: {
      topTenNormalPercentage: asPercentage("35"),
      largestNormalPercentage: asPercentage("8"),
      exclusionsVerified: true,
    },
    ...overrides,
  };
}

function outcome(snapshot: TokenSecuritySnapshot, ruleId: string): string | undefined {
  return evaluateTokenSecurity(snapshot).results.find((item) => item.ruleId === ruleId)?.outcome;
}

describe("canonical token identity", () => {
  it("accepts a 32-byte base58 mint and freezes a valid token", () => {
    const token = createToken({
      id: asUuid<TokenId>("00000000-0000-4000-8000-000000000002"),
      mint: asMintAddress("So11111111111111111111111111111111111111112"),
      program: "spl_token",
      decimals: 9,
    });

    expect(token.mint).toBe("So11111111111111111111111111111111111111112");
    expect(Object.isFrozen(token)).toBe(true);
  });

  it.each(["", "0OIl", "1111111111111111111111111111111", "111111111111111111111111111111111"])(
    "rejects invalid mint %j",
    (mint) => expect(() => asMintAddress(mint)).toThrow(TypeError),
  );

  it.each([-1, 1.5, 256])("rejects invalid decimals %s", (decimals) => {
    expect(() =>
      createToken({
        id: asUuid<TokenId>("00000000-0000-4000-8000-000000000002"),
        mint: asMintAddress("So11111111111111111111111111111111111111112"),
        program: "spl_token",
        decimals,
      }),
    ).toThrow("Token decimals");
  });
});

describe("token security", () => {
  it("passes all seven rules at the inclusive holder boundaries", () => {
    const decision = evaluateTokenSecurity(safeSnapshot());
    expect(decision.eligible).toBe(true);
    expect(decision.results).toHaveLength(7);
    expect(decision.failedRuleIds).toEqual([]);
  });

  it.each([
    ["SEC-001", { mintAuthority: "active" }],
    ["SEC-001", { mintAuthority: "unknown" }],
    ["SEC-002", { freezeAuthority: "active" }],
    ["SEC-002", { freezeAuthority: "unknown" }],
    ["SEC-003", { program: "token_2022" }],
    ["SEC-003", { program: "unknown" }],
  ] as const)("fails %s for unsafe or unknown authority/program data", (ruleId, override) => {
    expect(outcome(safeSnapshot(override), ruleId)).toBe("fail");
  });

  it.each([
    ["transfer_fee"],
    ["transfer_hook"],
    ["permanent_delegate"],
    ["pausable_transfer"],
    ["default_account_frozen"],
    ["unapproved"],
  ] as const)("fails SEC-004 for %s", (extension) => {
    expect(outcome(safeSnapshot({ extensions: [extension] }), "SEC-004")).toBe("fail");
  });

  it("fails SEC-004 when extensions cannot be excluded", () => {
    expect(outcome(safeSnapshot({ extensionsVerified: false }), "SEC-004")).toBe("fail");
  });

  it.each([
    ["34.999999", "7.999999", "pass", "pass"],
    ["35", "8", "pass", "pass"],
    ["35.000001", "8.000001", "fail", "fail"],
  ])(
    "applies exact holder boundaries at top-ten %s and largest %s",
    (topTen, largest, topOutcome, largestOutcome) => {
      const snapshot = safeSnapshot({
        holders: {
          topTenNormalPercentage: asPercentage(topTen),
          largestNormalPercentage: asPercentage(largest),
          exclusionsVerified: true,
        },
      });
      expect(outcome(snapshot, "SEC-008")).toBe(topOutcome);
      expect(outcome(snapshot, "SEC-010")).toBe(largestOutcome);
    },
  );

  it("fails holder rules and SEC-015 when exclusions are unverified", () => {
    const decision = evaluateTokenSecurity(
      safeSnapshot({
        holders: {
          topTenNormalPercentage: asPercentage("1"),
          largestNormalPercentage: asPercentage("1"),
          exclusionsVerified: false,
        },
      }),
    );
    expect(decision.failedRuleIds).toEqual(["SEC-008", "SEC-010", "SEC-015"]);
  });

  it("fails closed when holder data is missing", () => {
    expect(evaluateTokenSecurity(safeSnapshot({ holders: null })).failedRuleIds).toEqual([
      "SEC-008",
      "SEC-010",
      "SEC-015",
    ]);
  });

  it("requires evidence", () => {
    expect(() => evaluateTokenSecurity(safeSnapshot({ evidence: [] }))).toThrow(
      "requires source evidence",
    );
  });

  it("returns immutable results and exact rejection evidence", () => {
    const decision = evaluateTokenSecurity(safeSnapshot({ mintAuthority: "active" }));
    expect(decision.eligible).toBe(false);
    expect(decision.failedRuleIds).toContain("SEC-001");
    expect(decision.results[0]?.evidence).toEqual(evidence);
    expect(Object.isFrozen(decision.results)).toBe(true);
    expect(Object.isFrozen(decision.failedRuleIds)).toBe(true);
  });
});
