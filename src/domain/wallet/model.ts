import type { EvidenceReference } from "../shared/evidence.js";
import type {
  DecimalValue,
  Percentage,
  Timestamp,
  WalletAddress,
  WalletId,
} from "../shared/types.js";

export type WalletTier = "tier_a" | "tier_b" | "tier_c" | "ineligible";
export type ManipulationFlag =
  "self_trading" | "circular_transfers" | "bundling" | "developer_funding" | "exit_liquidity";

export interface WalletPerformanceSnapshot {
  readonly walletId: WalletId;
  readonly address: WalletAddress;
  /** Explicit common-control group; null means Tier-B independence is not established. */
  readonly independentGroupId: string | null;
  readonly evaluatedAt: Timestamp;
  readonly completedTrades: bigint;
  readonly verifiableTradePercentage: Percentage;
  readonly winRate: Percentage;
  readonly profitFactor: DecimalValue;
  readonly medianReturnPercentage: Percentage;
  readonly totalRealisedProfitUsd: DecimalValue;
  readonly medianHoldingMinutes: DecimalValue;
  readonly maximumDrawdownPercentage: Percentage;
  readonly manipulationFlags: readonly ManipulationFlag[];
  readonly evidence: readonly EvidenceReference[];
}

export interface WalletQualification {
  readonly walletId: WalletId;
  readonly tier: WalletTier;
  readonly eligible: boolean;
  readonly reasons: readonly string[];
  readonly evaluatedAt: Timestamp;
  readonly evidence: readonly EvidenceReference[];
}

export interface ConfirmingPurchase {
  readonly walletId: WalletId;
  readonly tier: Exclude<WalletTier, "tier_c" | "ineligible">;
  readonly purchasedAt: Timestamp;
  readonly observedAt: Timestamp;
  readonly purchaseValueUsd: DecimalValue;
  readonly retainedPercentage: Percentage;
  readonly entryPriceUsd: DecimalValue;
  readonly independentGroupId: string;
  readonly evidence: readonly EvidenceReference[];
}
