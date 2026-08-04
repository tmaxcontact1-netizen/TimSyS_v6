import type { ChainBalanceObservation, ObservationResult } from "../contracts/observations.js";
import type { MintAddress, Timestamp, WalletAddress } from "../../domain/shared/types.js";

export interface ChainObservationPort {
  observeBalances(
    wallet: WalletAddress,
    mint: MintAddress,
    requestedAt: Timestamp,
  ): Promise<ObservationResult<ChainBalanceObservation>>;
}
