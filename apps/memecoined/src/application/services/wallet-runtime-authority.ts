import { Decimal } from "decimal.js";

import { InvariantViolationError } from "../../domain/shared/errors.js";
import type { DecimalValue, RawAmount, WalletAddress } from "../../domain/shared/types.js";

export interface TrackedWalletBalance {
  readonly wallet: WalletAddress;
  readonly entryBalanceRaw: RawAmount;
  readonly currentBalanceRaw: RawAmount;
}

export interface WalletRuntimeAuthorityInput {
  readonly developerRelated: readonly TrackedWalletBalance[];
  readonly originatingTierA: TrackedWalletBalance | null;
  readonly confirmingTierB: readonly [TrackedWalletBalance, TrackedWalletBalance] | null;
}

export interface WalletRuntimeAuthorityFacts {
  readonly developerRelatedSoldPercentage: DecimalValue | null;
  readonly originatingTierASoldPercentage: DecimalValue | null;
  readonly confirmingTierBSoldPercentages: readonly [DecimalValue, DecimalValue] | null;
}

function soldPercentage(entry: bigint, current: bigint, label: string): DecimalValue {
  if (entry <= 0n) throw new InvariantViolationError(`${label} entry balance must be positive`);
  if (current < 0n)
    throw new InvariantViolationError(`${label} current balance cannot be negative`);
  if (current > entry)
    throw new InvariantViolationError(`${label} current balance exceeds its entry authority`);
  return new Decimal(entry.toString())
    .minus(current.toString())
    .mul(100)
    .div(entry.toString()) as DecimalValue;
}

function uniqueWallets(values: readonly TrackedWalletBalance[]): void {
  const wallets = new Set<string>();
  for (const value of values) {
    if (value.wallet.trim().length === 0)
      throw new InvariantViolationError("Tracked wallet address is required");
    if (wallets.has(value.wallet))
      throw new InvariantViolationError("Tracked wallet authority contains a duplicate wallet");
    wallets.add(value.wallet);
  }
}

/** Derives emergency-sale facts from confirmed entry and current token balances. */
export function deriveWalletRuntimeAuthority(
  input: WalletRuntimeAuthorityInput,
): WalletRuntimeAuthorityFacts {
  const all = [
    ...input.developerRelated,
    ...(input.originatingTierA === null ? [] : [input.originatingTierA]),
    ...(input.confirmingTierB === null ? [] : input.confirmingTierB),
  ];
  uniqueWallets(all);

  const developerRelatedSoldPercentage =
    input.developerRelated.length === 0
      ? null
      : soldPercentage(
          input.developerRelated.reduce((total, value) => total + value.entryBalanceRaw, 0n),
          input.developerRelated.reduce((total, value) => total + value.currentBalanceRaw, 0n),
          "Developer-related wallet group",
        );
  return Object.freeze({
    developerRelatedSoldPercentage,
    originatingTierASoldPercentage:
      input.originatingTierA === null
        ? null
        : soldPercentage(
            input.originatingTierA.entryBalanceRaw,
            input.originatingTierA.currentBalanceRaw,
            "Originating Tier A wallet",
          ),
    confirmingTierBSoldPercentages:
      input.confirmingTierB === null
        ? null
        : (Object.freeze(
            input.confirmingTierB.map((value) =>
              soldPercentage(
                value.entryBalanceRaw,
                value.currentBalanceRaw,
                "Confirming Tier B wallet",
              ),
            ),
          ) as readonly [DecimalValue, DecimalValue]),
  });
}
