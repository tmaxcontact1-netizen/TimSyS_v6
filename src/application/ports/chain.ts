import type {
  ChainBalanceObservation,
  ChainTransactionObservation,
  ObservationResult,
} from "../contracts/observations.js";
import type { MintAddress, Timestamp, WalletAddress } from "../../domain/shared/types.js";

export interface ChainObservationPort {
  observeBalances(
    wallet: WalletAddress,
    mint: MintAddress,
    requestedAt: Timestamp,
  ): Promise<ObservationResult<ChainBalanceObservation>>;
}

export interface ChainTransactionObservationPort {
  observeTransaction(
    signature: string,
    wallet: WalletAddress,
    mint: MintAddress,
    requestedAt: Timestamp,
  ): Promise<ObservationResult<ChainTransactionObservation>>;
}
