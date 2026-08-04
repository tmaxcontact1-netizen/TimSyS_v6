import type { EvidenceReference } from "../../domain/shared/evidence.js";
import type {
  BasisPoints,
  MintAddress,
  RawAmount,
  Timestamp,
  WalletAddress,
} from "../../domain/shared/types.js";
import type { ExecutableQuote, SimulationResult } from "../../domain/trading/quote.js";

export interface ExactInputQuoteRequest {
  readonly inputMint: MintAddress;
  readonly outputMint: MintAddress;
  readonly inputAmount: RawAmount;
  readonly slippageBasisPoints: BasisPoints;
  readonly requestedAt: Timestamp;
}

export interface SwapConstructionRequest {
  readonly quote: ExecutableQuote;
  readonly wallet: WalletAddress;
  readonly requestedAt: Timestamp;
}

export interface ConstructedSwap {
  readonly fingerprint: string;
  readonly quoteFingerprint: string;
  readonly wallet: WalletAddress;
  readonly serializedTransactionBase64: string;
  readonly lastValidBlockHeight: bigint;
  readonly prioritizationFeeLamports: RawAmount;
  readonly requestedAt: Timestamp;
  readonly receivedAt: Timestamp;
  readonly evidence: readonly EvidenceReference[];
}

export interface SwapSimulation {
  readonly result: SimulationResult;
  readonly transactionFingerprint: string;
  readonly unitsConsumed: bigint | null;
  readonly error: unknown | null;
  readonly logs: readonly string[];
  readonly requestedAt: Timestamp;
  readonly receivedAt: Timestamp;
  readonly evidence: readonly EvidenceReference[];
}

export type SwapFailureCode =
  "validation" | "rate_limited" | "unavailable" | "malformed" | "expired" | "simulation_failed";

export interface SwapFailure {
  readonly code: SwapFailureCode;
  readonly provider: "jupiter" | "solana_rpc";
  readonly occurredAt: Timestamp;
  readonly retryable: boolean;
  readonly reason: string;
}

export type SwapResult<Value> =
  Readonly<{ ok: true; value: Value }> | Readonly<{ ok: false; error: SwapFailure }>;

export interface SwapPort {
  quote(request: ExactInputQuoteRequest): Promise<SwapResult<ExecutableQuote>>;
  construct(request: SwapConstructionRequest): Promise<SwapResult<ConstructedSwap>>;
  simulate(swap: ConstructedSwap, requestedAt: Timestamp): Promise<SwapResult<SwapSimulation>>;
}
