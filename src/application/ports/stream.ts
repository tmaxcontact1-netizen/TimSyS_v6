import type { ObservationTrace } from "../contracts/observations.js";
import type {
  MintAddress,
  RawAmount,
  SolanaSlot,
  Timestamp,
  WalletAddress,
  WalletId,
} from "../../domain/shared/types.js";

/** Provider-normalized acquisition evidence. Valuation is deliberately not inferred here. */
export interface TrackedWalletPurchaseObservation {
  readonly walletId: WalletId;
  readonly wallet: WalletAddress;
  readonly signature: string;
  readonly mint: MintAddress;
  readonly purchasedAt: Timestamp;
  readonly observedAt: Timestamp;
  readonly slot: SolanaSlot;
  readonly acquiredAmountRaw: RawAmount;
  readonly nativeSpentLamports: RawAmount;
  readonly trace: ObservationTrace;
}

export interface TrackedWalletPurchasePort {
  observePurchases(input: {
    readonly walletId: WalletId;
    readonly wallet: WalletAddress;
    readonly afterSignature: string | null;
    readonly requestedAt: Timestamp;
  }): Promise<readonly TrackedWalletPurchaseObservation[]>;
}
