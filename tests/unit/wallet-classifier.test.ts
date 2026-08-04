import { describe, expect, it } from "vitest";

import {
  asDecimal,
  asPercentage,
  asTimestamp,
  asUuid,
  type WalletId,
} from "../../src/domain/shared/types.js";
import type { ConfirmingPurchase } from "../../src/domain/wallet/model.js";
import { classifyWalletConfirmation } from "../../src/domain/wallet/classifier.js";

const now = asTimestamp("2026-08-04T20:10:00Z");
const purchase = (
  id: string,
  tier: "tier_a" | "tier_b",
  group: string,
  at = "2026-08-04T20:05:00Z",
): ConfirmingPurchase => ({
  walletId: asUuid<WalletId>(id),
  tier,
  independentGroupId: group,
  purchasedAt: asTimestamp(at),
  observedAt: now,
  purchaseValueUsd: asDecimal(500),
  retainedPercentage: asPercentage(70),
  entryPriceUsd: asDecimal(1),
  evidence: [
    {
      id: asUuid("00000000-0000-4000-8000-000000000999"),
      provider: "solana_rpc",
      observedAt: now,
      sourceKey: `purchase:${id}`,
    },
  ],
});
const facts = (purchases: readonly ConfirmingPurchase[]) => ({
  evaluatedAt: now,
  currentPriceUsd: asDecimal(1.2),
  poolLiquidityUsd: asDecimal(200_000),
  purchases,
});

describe("wallet purchase confirmation", () => {
  it("accepts one current retained Tier A purchase", () => {
    expect(
      classifyWalletConfirmation(
        facts([purchase("00000000-0000-4000-8000-000000000911", "tier_a", "a")]),
      ),
    ).toBe("tier_a");
  });

  it("requires two distinct and independent Tier B wallets", () => {
    const first = purchase("00000000-0000-4000-8000-000000000912", "tier_b", "a");
    const second = purchase("00000000-0000-4000-8000-000000000913", "tier_b", "b");
    expect(classifyWalletConfirmation(facts([first, second]))).toBe("two_tier_b");
    expect(classifyWalletConfirmation(facts([first, { ...second, independentGroupId: "a" }]))).toBe(
      "none",
    );
  });

  it("rejects stale, undersized, sold, or overpriced purchases", () => {
    const base = purchase("00000000-0000-4000-8000-000000000914", "tier_a", "a");
    expect(
      classifyWalletConfirmation(
        facts([{ ...base, purchasedAt: asTimestamp("2026-08-04T19:59:59Z") }]),
      ),
    ).toBe("none");
    expect(classifyWalletConfirmation(facts([{ ...base, purchaseValueUsd: asDecimal(499) }]))).toBe(
      "none",
    );
    expect(
      classifyWalletConfirmation(facts([{ ...base, retainedPercentage: asPercentage(69) }])),
    ).toBe("none");
    expect(classifyWalletConfirmation({ ...facts([base]), currentPriceUsd: asDecimal(1.21) })).toBe(
      "none",
    );
  });
});
