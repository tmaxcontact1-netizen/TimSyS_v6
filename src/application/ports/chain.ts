import type {
  ChainBalanceObservation,
  ChainTransactionObservation,
  ObservationResult,
  WalletInventoryObservation,
} from "../contracts/observations.js";
import type { EvidenceReference } from "../../domain/shared/evidence.js";
import type { MintAddress, Timestamp, WalletAddress } from "../../domain/shared/types.js";

export interface ChainProviderAgreementRecorder {
  record(input: {
    readonly authorityKey: string;
    readonly wallet: WalletAddress;
    readonly observedAt: Timestamp;
    readonly agrees: boolean;
    readonly evidence: readonly EvidenceReference[];
  }): Promise<void>;
}

export interface ChainObservationPort {
  observeBalances(
    wallet: WalletAddress,
    mint: MintAddress,
    requestedAt: Timestamp,
  ): Promise<ObservationResult<ChainBalanceObservation>>;
}

export interface WalletInventoryObservationPort {
  observeWalletInventory(
    wallet: WalletAddress,
    requestedAt: Timestamp,
  ): Promise<ObservationResult<WalletInventoryObservation>>;
}

export interface ChainTransactionObservationPort {
  observeTransaction(
    signature: string,
    wallet: WalletAddress,
    mint: MintAddress,
    requestedAt: Timestamp,
  ): Promise<ObservationResult<ChainTransactionObservation>>;
}
