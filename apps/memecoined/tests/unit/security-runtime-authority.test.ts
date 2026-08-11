import { describe, expect, it } from "vitest";

import { deriveSecurityRuntimeAuthority } from "../../src/application/services/security-runtime-authority.js";
import type { TokenSecuritySnapshot } from "../../src/domain/token/security.js";
import {
  asPercentage,
  asTimestamp,
  asUuid,
  type EvidenceId,
} from "../../src/domain/shared/types.js";

const evidence = Object.freeze([
  {
    id: asUuid<EvidenceId>("00000000-0000-4000-8000-000000004001"),
    provider: "solana_rpc" as const,
    observedAt: asTimestamp("2026-08-04T12:00:00.000Z"),
    sourceKey: "mint:authority",
  },
]);

function snapshot(overrides: Partial<TokenSecuritySnapshot> = {}): TokenSecuritySnapshot {
  return {
    observedAt: asTimestamp("2026-08-04T12:00:00.000Z"),
    evidence,
    directlyVerifiedOnChain: true,
    program: "spl_token",
    mintAuthority: "revoked",
    freezeAuthority: "revoked",
    extensions: [],
    extensionsVerified: true,
    holders: {
      topTenNormalPercentage: asPercentage("20"),
      largestNormalPercentage: asPercentage("5"),
      exclusionsVerified: true,
    },
    ...overrides,
  };
}

describe("security runtime authority", () => {
  it("flags a security rule that passed at entry and fails now", () => {
    expect(
      deriveSecurityRuntimeAuthority({
        entry: snapshot(),
        current: snapshot({
          observedAt: asTimestamp("2026-08-04T12:05:00.000Z"),
          mintAuthority: "active",
        }),
      }),
    ).toEqual({ dangerousSecurityChangeDetected: true });
  });

  it("does not flag an unchanged directly verified security state", () => {
    expect(
      deriveSecurityRuntimeAuthority({
        entry: snapshot(),
        current: snapshot({ observedAt: asTimestamp("2026-08-04T12:05:00.000Z") }),
      }),
    ).toEqual({ dangerousSecurityChangeDetected: false });
  });

  it("rejects unverified or time-reversed comparisons", () => {
    expect(() =>
      deriveSecurityRuntimeAuthority({
        entry: snapshot(),
        current: snapshot({ directlyVerifiedOnChain: false }),
      }),
    ).toThrow(/direct on-chain/);
    expect(() =>
      deriveSecurityRuntimeAuthority({
        entry: snapshot({ observedAt: asTimestamp("2026-08-04T12:10:00.000Z") }),
        current: snapshot(),
      }),
    ).toThrow(/cannot follow/);
  });
});
