import { Decimal } from "decimal.js";

import { InvariantViolationError } from "../shared/errors.js";
import { asDecimal, type DecimalValue, type Percentage } from "../shared/types.js";

export type WalletConfirmation = "tier_a" | "two_tier_b" | "none";

export interface CandidateScoreInput {
  readonly walletConfirmation: WalletConfirmation;
  readonly liquidityUsd: DecimalValue | null;
  readonly fiveMinutePriceChange: Percentage | null;
  readonly topTenNormalPercentage: Percentage | null;
  readonly fiveMinuteBuyTransactions: bigint | null;
  readonly fiveMinuteSellTransactions: bigint | null;
}

export interface CandidateScore {
  readonly wallet: number;
  readonly liquidity: number;
  readonly momentum: number;
  readonly holders: number;
  readonly volumeQuality: number;
  readonly total: number;
}

function ratio(buys: bigint | null, sells: bigint | null): Decimal | null {
  if (buys === null || sells === null) return null;
  if (sells === 0n) return buys > 0n ? new Decimal(Infinity) : null;
  return new Decimal(buys.toString()).div(sells.toString());
}

/** Calculates exactly one band per approved score component; missing facts score zero. */
export function scoreCandidate(input: CandidateScoreInput): CandidateScore {
  if ((input.fiveMinuteBuyTransactions ?? 0n) < 0n || (input.fiveMinuteSellTransactions ?? 0n) < 0n)
    throw new InvariantViolationError("Candidate transaction counts must be non-negative");
  const change = input.fiveMinutePriceChange;
  const concentration = input.topTenNormalPercentage;
  const transactionRatio = ratio(input.fiveMinuteBuyTransactions, input.fiveMinuteSellTransactions);
  const wallet =
    input.walletConfirmation === "tier_a" ? 30 : input.walletConfirmation === "two_tier_b" ? 25 : 0;
  const liquidity =
    input.liquidityUsd === null
      ? 0
      : input.liquidityUsd.gte(250_000)
        ? 20
        : input.liquidityUsd.gte(150_000)
          ? 15
          : input.liquidityUsd.gte(75_000)
            ? 10
            : 0;
  const momentum =
    change === null
      ? 0
      : change.gte(5) && change.lte(12)
        ? 20
        : change.gte(3) && change.lte(18)
          ? 12
          : 0;
  const holders =
    concentration === null ? 0 : concentration.lt(25) ? 15 : concentration.lte(35) ? 8 : 0;
  const volumeQuality =
    transactionRatio === null
      ? 0
      : transactionRatio.gte(1.8)
        ? 10
        : transactionRatio.gte(1.3)
          ? 5
          : 0;
  const total = wallet + liquidity + momentum + holders + volumeQuality;
  return Object.freeze({ wallet, liquidity, momentum, holders, volumeQuality, total });
}

export const scoreAsDecimal = (score: CandidateScore): DecimalValue => asDecimal(score.total);
