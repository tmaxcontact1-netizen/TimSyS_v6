import type { ObservationResult, PoolMarketObservation } from "../contracts/observations.js";
import type { MintAddress, Timestamp } from "../../domain/shared/types.js";

export interface MarketObservationPort {
  observePrimaryPool(
    mint: MintAddress,
    requestedAt: Timestamp,
  ): Promise<ObservationResult<PoolMarketObservation>>;
}
