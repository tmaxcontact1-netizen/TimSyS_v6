import { describe, expect, it } from "vitest";

import { deriveWalletRuntimeAuthority } from "../../src/application/services/wallet-runtime-authority.js";
import { asRawAmount, type WalletAddress } from "../../src/domain/shared/types.js";

const balance = (wallet: string, entry: bigint, current: bigint) => ({
  wallet: wallet as WalletAddress,
  entryBalanceRaw: asRawAmount(entry),
  currentBalanceRaw: asRawAmount(current),
});

describe("wallet runtime authority", () => {
  it("computes exact group and classified-wallet sale percentages", () => {
    const facts = deriveWalletRuntimeAuthority({
      developerRelated: [balance("dev-a", 100n, 90n), balance("dev-b", 300n, 210n)],
      originatingTierA: balance("tier-a", 200n, 100n),
      confirmingTierB: [balance("tier-b-1", 100n, 70n), balance("tier-b-2", 100n, 60n)],
    });
    expect(facts.developerRelatedSoldPercentage?.toString()).toBe("25");
    expect(facts.originatingTierASoldPercentage?.toString()).toBe("50");
    expect(facts.confirmingTierBSoldPercentages?.map(String)).toEqual(["30", "40"]);
  });

  it("preserves unknown authority instead of manufacturing zero sales", () => {
    expect(
      deriveWalletRuntimeAuthority({
        developerRelated: [],
        originatingTierA: null,
        confirmingTierB: null,
      }),
    ).toEqual({
      developerRelatedSoldPercentage: null,
      originatingTierASoldPercentage: null,
      confirmingTierBSoldPercentages: null,
    });
  });

  it("rejects duplicate wallets and balances above the immutable entry baseline", () => {
    expect(() =>
      deriveWalletRuntimeAuthority({
        developerRelated: [balance("same", 100n, 90n)],
        originatingTierA: balance("same", 100n, 90n),
        confirmingTierB: null,
      }),
    ).toThrow(/duplicate/);
    expect(() =>
      deriveWalletRuntimeAuthority({
        developerRelated: [balance("dev", 100n, 101n)],
        originatingTierA: null,
        confirmingTierB: null,
      }),
    ).toThrow(/exceeds/);
  });
});
