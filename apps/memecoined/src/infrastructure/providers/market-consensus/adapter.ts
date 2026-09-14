import { Decimal } from "decimal.js";
import type { ObservationResult, PoolMarketObservation } from "../../../application/contracts/observations.js";
import type { CandidateDiscoveryObservation, CandidateDiscoveryPort, MarketObservationPort } from "../../../application/ports/market.js";
import type { MintAddress, Timestamp } from "../../../domain/shared/types.js";

/** Combines discovery and requires independent prices to remain within a generous calibration tolerance. */
export class ConfirmedMarketAdapter implements MarketObservationPort, CandidateDiscoveryPort {
  public constructor(private readonly primary: MarketObservationPort & CandidateDiscoveryPort, private readonly confirmation: MarketObservationPort & CandidateDiscoveryPort) {}

  public async discoverLatestTokens(at: Timestamp): Promise<ObservationResult<readonly CandidateDiscoveryObservation[]>> {
    const [left, right] = await Promise.all([this.primary.discoverLatestTokens(at), this.confirmation.discoverLatestTokens(at)]);
    if (!left.ok && !right.ok) return left;
    const values = [...(left.ok ? left.value : []), ...(right.ok ? right.value : [])];
    const unique = new Map(values.map((item) => [item.mint, item]));
    return Object.freeze({ ok: true, value: Object.freeze([...unique.values()]) });
  }

  public async observePrimaryPool(mint: MintAddress, at: Timestamp): Promise<ObservationResult<PoolMarketObservation>> {
    const [primary, confirmation] = await Promise.all([this.primary.observePrimaryPool(mint, at), this.confirmation.observePrimaryPool(mint, at)]);
    if (!primary.ok) return confirmation;
    if (!confirmation.ok) return primary;
    const a = primary.value.priceUsd;
    const b = confirmation.value.priceUsd;
    if (a && b && a.gt(0) && b.gt(0)) {
      const difference = Decimal.abs(a.minus(b)).div(Decimal.max(a, b));
      if (difference.gt(0.2)) return Object.freeze({ ok: false, error: Object.freeze({ code: "contradictory", provider: "geckoterminal", occurredAt: at, retryable: true, reason: "Independent market prices differ by more than 20%" }) });
    }
    const liquidity = primary.value.liquidityUsd && confirmation.value.liquidityUsd
      ? (Decimal.min(primary.value.liquidityUsd, confirmation.value.liquidityUsd) as typeof primary.value.liquidityUsd)
      : primary.value.liquidityUsd;
    return Object.freeze({ ok: true, value: Object.freeze({ ...primary.value, liquidityUsd: liquidity,
      traces: Object.freeze([...(primary.value.traces ?? [primary.value.trace]), ...(confirmation.value.traces ?? [confirmation.value.trace])]) }) });
  }
}
