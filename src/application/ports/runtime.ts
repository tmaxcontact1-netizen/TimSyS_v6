import type { EvidenceReference } from "../../domain/shared/evidence.js";
import type {
  AuditEventId,
  DecimalValue,
  MintAddress,
  OrderId,
  PositionId,
  Timestamp,
  TokenId,
  WalletAddress,
} from "../../domain/shared/types.js";
import type { PendingPositionAction, PositionWorkerCheckpoint } from "./repositories.js";
import type { PositionRuntimeStep } from "../services/position-monitor.js";

export interface PositionMonitoringFacts {
  readonly stepId: string;
  readonly positionId: PositionId;
  readonly tokenId: TokenId;
  readonly observationRequestedAt: Timestamp;
  readonly evaluatedAt: Timestamp;
  readonly wallet: WalletAddress;
  readonly tokenMint: MintAddress;
  readonly settlementMint: MintAddress;
  readonly liquidityUsdTenMinutesAgo: DecimalValue | null;
  readonly developerRelatedSoldPercentage: DecimalValue | null;
  readonly originatingTierASoldPercentage: DecimalValue | null;
  readonly confirmingTierBSoldPercentages: readonly [DecimalValue, DecimalValue] | null;
  readonly dangerousSecurityChangeDetected: boolean | null;
  readonly priorFullExitPriceImpactPercentages: readonly DecimalValue[];
  readonly marketDataUnavailableSince: Timestamp | null;
  readonly allChainAccessUnavailableSince: Timestamp | null;
  readonly evidence: readonly EvidenceReference[];
  readonly orderId: OrderId;
  readonly peakEventId: AuditEventId;
  readonly exitRequestedEventId: AuditEventId;
}

export interface PositionMonitoringFactsSource {
  loadFacts(checkpoint: PositionWorkerCheckpoint): Promise<PositionMonitoringFacts>;
}

export interface PositionRuntimeStepSource {
  nextStep(checkpoint: PositionWorkerCheckpoint): Promise<PositionRuntimeStep>;
}

/** Dispatch must be idempotent on deliveryId. */
export interface PositionRuntimeActionDispatcher {
  dispatch(pending: PendingPositionAction): Promise<void>;
}
