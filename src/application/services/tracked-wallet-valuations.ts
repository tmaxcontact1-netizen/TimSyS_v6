import { Decimal } from "decimal.js";

import type { ChainObservationPort } from "../ports/chain.js";
import type { MarketObservationPort } from "../ports/market.js";
import type { ObservationTrace } from "../contracts/observations.js";
import { asPercentage } from "../../domain/shared/types.js";
import type {
  CandidateId,
  MintAddress,
  RawAmount,
  Timestamp,
  WalletAddress,
} from "../../domain/shared/types.js";

export interface UnvaluedTrackedWalletPurchase {
  readonly observationId: bigint;
  readonly candidateId: CandidateId;
  readonly wallet: WalletAddress;
  readonly mint: MintAddress;
  readonly acquiredAmountRaw: RawAmount;
  readonly tokenDecimals: number;
}

export interface TrackedWalletPurchaseValuation {
  readonly purchase: UnvaluedTrackedWalletPurchase;
  readonly valuedAt: Timestamp;
  readonly priceUsd: Decimal;
  readonly liquidityUsd: Decimal;
  readonly purchaseValueUsd: Decimal;
  readonly retainedAmountRaw: RawAmount;
  readonly retainedPercentage: Decimal;
  readonly marketEvidence: ObservationTrace;
  readonly balanceEvidence: readonly ObservationTrace[];
}

export interface TrackedWalletValuationRepository {
  loadUnvalued(limit: number): Promise<readonly UnvaluedTrackedWalletPurchase[]>;
  save(valuation: TrackedWalletPurchaseValuation): Promise<boolean>;
}

function retainedPercentage(current: bigint, acquired: bigint): Decimal {
  if (acquired <= 0n) throw new Error("Tracked-wallet acquisition must be positive");
  const bounded = current > acquired ? acquired : current;
  return new Decimal(bounded.toString()).mul(100).div(acquired.toString());
}

/** Binds one immutable market snapshot to one agreed on-chain retained balance. */
export async function runTrackedWalletValuationCycle(input: {
  readonly repository: TrackedWalletValuationRepository;
  readonly market: MarketObservationPort;
  readonly balances: ChainObservationPort;
  readonly now: () => Timestamp;
  readonly limit: number;
}): Promise<number> {
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100)
    throw new RangeError("Tracked-wallet valuation limit must be between 1 and 100");
  let saved = 0;
  for (const purchase of await input.repository.loadUnvalued(input.limit)) {
    const valuedAt = input.now();
    const [market, balance] = await Promise.all([
      input.market.observePrimaryPool(purchase.mint, valuedAt),
      input.balances.observeBalances(purchase.wallet, purchase.mint, valuedAt),
    ]);
    if (!market.ok) throw new Error(`Market valuation unavailable: ${market.error.code}`);
    if (!balance.ok) throw new Error(`Retained balance unavailable: ${balance.error.code}`);
    if (market.value.mint !== purchase.mint || balance.value.mint !== purchase.mint)
      throw new Error("Valuation evidence returned a mismatched mint");
    if (balance.value.wallet !== purchase.wallet)
      throw new Error("Valuation evidence returned a mismatched wallet");
    if (market.value.priceUsd === null || market.value.priceUsd.lte(0))
      throw new Error("Market valuation requires a positive USD price");
    if (market.value.liquidityUsd === null || market.value.liquidityUsd.lte(0))
      throw new Error("Market valuation requires positive USD liquidity");
    const tokenAmount = new Decimal(purchase.acquiredAmountRaw.toString()).div(
      new Decimal(10).pow(purchase.tokenDecimals),
    );
    const percentage = retainedPercentage(
      balance.value.tokenBalanceRaw,
      purchase.acquiredAmountRaw,
    );
    saved += Number(
      await input.repository.save({
        purchase,
        valuedAt,
        priceUsd: market.value.priceUsd,
        liquidityUsd: market.value.liquidityUsd,
        purchaseValueUsd: tokenAmount.mul(market.value.priceUsd),
        retainedAmountRaw: balance.value.tokenBalanceRaw,
        retainedPercentage: asPercentage(percentage),
        marketEvidence: market.value.trace,
        balanceEvidence: balance.value.traces,
      }),
    );
  }
  return saved;
}
