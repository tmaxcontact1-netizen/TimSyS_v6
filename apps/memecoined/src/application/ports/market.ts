import type {
  ObservationResult,
  ObservationTrace,
  PoolMarketObservation,
} from "../contracts/observations.js";
import type { MintAddress, Timestamp } from "../../domain/shared/types.js";

export interface CandidateDiscoveryObservation {
  readonly mint: MintAddress;
  readonly sourceReference: string;
  readonly observedAt: Timestamp;
  readonly trace: ObservationTrace;
}

export interface CandidateDiscoveryPort {
  discoverLatestTokens(
    requestedAt: Timestamp,
  ): Promise<ObservationResult<readonly CandidateDiscoveryObservation[]>>;
}

export interface MarketObservationPort {
  observePrimaryPool(
    mint: MintAddress,
    requestedAt: Timestamp,
  ): Promise<ObservationResult<PoolMarketObservation>>;
}
