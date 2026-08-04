import type {
  DecimalValue,
  EvidenceId,
  MintAddress,
  PoolId,
  ProviderId,
  RawAmount,
  SolanaSlot,
  Timestamp,
  WalletAddress,
} from "../../domain/shared/types.js";

export interface ObservationTrace {
  readonly evidenceId: EvidenceId;
  readonly provider: ProviderId;
  readonly method: string;
  readonly requestedAt: Timestamp;
  readonly respondedAt: Timestamp;
  readonly sourceTimestamp: Timestamp | null;
  readonly normalizedAt: Timestamp;
  readonly sourceKey: string;
  readonly contentHash: string;
  readonly slot?: SolanaSlot;
}

export type ObservationFailureCode =
  "unavailable" | "rate_limited" | "not_indexed" | "malformed" | "contradictory";

export interface ObservationFailure {
  readonly code: ObservationFailureCode;
  readonly provider: ProviderId;
  readonly occurredAt: Timestamp;
  readonly retryable: boolean;
  readonly reason: string;
}

export type ObservationResult<Value> =
  Readonly<{ ok: true; value: Value }> | Readonly<{ ok: false; error: ObservationFailure }>;

export interface PoolMarketObservation {
  readonly mint: MintAddress;
  readonly poolId: PoolId;
  readonly pairAddress: string;
  readonly dexId: string;
  readonly baseMint: MintAddress;
  readonly quoteMint: string;
  readonly pairCreatedAt: Timestamp | null;
  readonly priceUsd: DecimalValue | null;
  readonly liquidityUsd: DecimalValue | null;
  readonly marketCapitalizationUsd: DecimalValue | null;
  readonly fullyDilutedValuationUsd: DecimalValue | null;
  readonly fiveMinuteVolumeUsd: DecimalValue | null;
  readonly fiveMinuteBuys: bigint | null;
  readonly fiveMinuteSells: bigint | null;
  readonly fiveMinutePriceChangePercentage: DecimalValue | null;
  readonly trace: ObservationTrace;
}

export interface ChainBalanceObservation {
  readonly wallet: WalletAddress;
  readonly mint: MintAddress;
  readonly nativeBalanceLamports: RawAmount;
  readonly tokenBalanceRaw: RawAmount;
  readonly slot: SolanaSlot;
  readonly agreeingProviders: readonly ProviderId[];
  readonly traces: readonly ObservationTrace[];
}

export type TransactionConfirmationState = "pending" | "confirmed" | "failed";

/** Raw wallet deltas reconstructed from the authoritative Solana transaction metadata. */
export interface ChainTransactionObservation {
  readonly signature: string;
  readonly state: TransactionConfirmationState;
  readonly slot: SolanaSlot | null;
  readonly onChainError: boolean | null;
  readonly wallet: WalletAddress;
  readonly mint: MintAddress;
  readonly tokenBalanceBeforeRaw: RawAmount | null;
  readonly tokenBalanceAfterRaw: RawAmount | null;
  readonly nativeBalanceBeforeLamports: RawAmount | null;
  readonly nativeBalanceAfterLamports: RawAmount | null;
  readonly feeLamports: RawAmount | null;
  readonly tipLamports: RawAmount | null;
  readonly agreeingProviders: readonly ProviderId[];
  readonly traces: readonly ObservationTrace[];
}

export interface ObservationIdentityFactory {
  createEvidenceId(input: {
    readonly provider: ProviderId;
    readonly sourceKey: string;
    readonly contentHash: string;
  }): EvidenceId;
}
