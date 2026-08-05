import { Decimal } from "decimal.js";

import type { WalletInventoryObservationPort } from "../ports/chain.js";
import type { MarketObservationPort } from "../ports/market.js";
import type { ObservationTrace } from "../contracts/observations.js";
import type { EvidenceReference } from "../../domain/shared/evidence.js";
import {
  asNonNegativeDecimal,
  type DecimalValue,
  type MintAddress,
  type Timestamp,
  type WalletAddress,
} from "../../domain/shared/types.js";

export const WRAPPED_SOL_MINT = "So11111111111111111111111111111111111111112" as MintAddress;

export interface ValuedWalletHolding {
  readonly mint: MintAddress;
  readonly tokenAmount: DecimalValue;
  readonly priceUsd: DecimalValue;
  readonly valueUsd: DecimalValue;
  readonly valueSol: DecimalValue;
}

export interface PortfolioInventoryValuation {
  readonly observedAt: Timestamp;
  readonly wallet: WalletAddress;
  readonly nativeBalanceSol: DecimalValue;
  readonly nativePriceUsd: DecimalValue;
  readonly tokenValueUsd: DecimalValue;
  readonly tokenValueSol: DecimalValue;
  readonly equitySol: DecimalValue;
  readonly holdings: readonly ValuedWalletHolding[];
  readonly evidence: readonly EvidenceReference[];
}

function evidence(trace: ObservationTrace): EvidenceReference {
  return Object.freeze({
    id: trace.evidenceId,
    provider: trace.provider,
    observedAt: trace.normalizedAt,
    sourceKey: trace.sourceKey,
    ...(trace.slot === undefined ? {} : { slot: trace.slot }),
    contentHash: trace.contentHash,
  });
}

/** Values a complete, provider-agreed wallet inventory at one requested instant. */
export class LivePortfolioInventoryValuationSource {
  public constructor(
    private readonly wallet: WalletAddress,
    private readonly inventory: WalletInventoryObservationPort,
    private readonly market: MarketObservationPort,
  ) {}

  public async observe(requestedAt: Timestamp): Promise<PortfolioInventoryValuation> {
    const inventory = await this.inventory.observeWalletInventory(this.wallet, requestedAt);
    if (!inventory.ok)
      throw new Error(
        `Wallet inventory unavailable: ${inventory.error.code}: ${inventory.error.reason}`,
      );
    if (inventory.value.wallet !== this.wallet)
      throw new Error("Wallet inventory returned a mismatched wallet");

    const pricedMints = [WRAPPED_SOL_MINT, ...inventory.value.tokens.map(({ mint }) => mint)];
    const observations = await Promise.all(
      pricedMints.map((mint) => this.market.observePrimaryPool(mint, requestedAt)),
    );
    const prices = observations.map((result, index) => {
      const mint = pricedMints[index]!;
      if (!result.ok)
        throw new Error(
          `Market valuation unavailable for ${mint}: ${result.error.code}: ${result.error.reason}`,
        );
      if (result.value.mint !== mint)
        throw new Error("Market valuation returned a mismatched mint");
      if (result.value.priceUsd === null || result.value.priceUsd.lte(0))
        throw new Error("Portfolio valuation requires a positive USD price for every asset");
      return result.value;
    });
    const nativePriceUsd = prices[0]!.priceUsd!;
    const holdings = inventory.value.tokens.map((token, index) => {
      const priceUsd = prices[index + 1]!.priceUsd!;
      const tokenAmount = new Decimal(token.amountRaw.toString()).div(
        new Decimal(10).pow(token.decimals),
      );
      const valueUsd = tokenAmount.mul(priceUsd);
      return Object.freeze({
        mint: token.mint,
        tokenAmount: asNonNegativeDecimal(tokenAmount),
        priceUsd,
        valueUsd: asNonNegativeDecimal(valueUsd),
        valueSol: asNonNegativeDecimal(valueUsd.div(nativePriceUsd)),
      });
    });
    const nativeBalanceSol = new Decimal(inventory.value.nativeBalanceLamports.toString()).div(1e9);
    const tokenValueUsd = holdings.reduce(
      (total, holding) => total.plus(holding.valueUsd),
      new Decimal(0),
    );
    const tokenValueSol = tokenValueUsd.div(nativePriceUsd);
    const allEvidence = [
      ...inventory.value.traces.map(evidence),
      ...prices.map(({ trace }) => evidence(trace)),
    ];
    if (new Set(allEvidence.map(({ id }) => id)).size !== allEvidence.length)
      throw new Error("Portfolio valuation evidence must be unique");

    return Object.freeze({
      observedAt: requestedAt,
      wallet: this.wallet,
      nativeBalanceSol: asNonNegativeDecimal(nativeBalanceSol),
      nativePriceUsd,
      tokenValueUsd: asNonNegativeDecimal(tokenValueUsd),
      tokenValueSol: asNonNegativeDecimal(tokenValueSol),
      equitySol: asNonNegativeDecimal(nativeBalanceSol.plus(tokenValueSol)),
      holdings: Object.freeze(holdings),
      evidence: Object.freeze(allEvidence),
    });
  }
}
