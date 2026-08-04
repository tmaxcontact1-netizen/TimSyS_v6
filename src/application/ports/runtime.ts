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
import type {
  LocalSignerPort,
  TransactionInspectorPort,
  TransactionSubmissionPort,
} from "./signer.js";
import type { SubmissionReceipt } from "./signer.js";

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
  dispatch(pending: PendingPositionAction): Promise<SubmissionReceipt | void>;
}

export interface PositionReconciliationFacts {
  readonly stepId: string;
  readonly observationRequestedAt: Timestamp;
  readonly evaluatedAt: Timestamp;
  readonly wallet: WalletAddress;
  readonly tokenMint: MintAddress;
  readonly eventId: AuditEventId;
}

export interface PositionReconciliationFactsSource {
  loadFacts(checkpoint: PositionWorkerCheckpoint): Promise<PositionReconciliationFacts>;
}

export interface ExecutionAuthorityPort {
  currentBlockHeight(): Promise<bigint>;
  now(): Timestamp;
}

export interface PositionActionDispatcherDependencies {
  readonly inspector: TransactionInspectorPort;
  readonly signer: LocalSignerPort;
  readonly submission: TransactionSubmissionPort;
  readonly authority: ExecutionAuthorityPort;
}

export interface ReconciliationJobLease {
  readonly positionId: PositionId;
  readonly ownerId: string;
  readonly failedAttempts: number;
}

export interface ReconciliationJobFailure {
  readonly stage: "transaction" | "balance" | "confirmation";
  readonly code: string;
  readonly reason: string;
  readonly occurredAt: Timestamp;
}

export interface ReconciliationJobStore {
  tryAcquire(input: {
    readonly positionId: PositionId;
    readonly ownerId: string;
    readonly now: Timestamp;
  }): Promise<ReconciliationJobLease | null>;
  complete(lease: ReconciliationJobLease): Promise<void>;
  retry(
    lease: ReconciliationJobLease,
    availableAt: Timestamp,
    failure: ReconciliationJobFailure,
  ): Promise<void>;
  fail(lease: ReconciliationJobLease, failure: ReconciliationJobFailure): Promise<void>;
}

export interface ReconciliationEscalationPort {
  critical(input: {
    readonly positionId: PositionId;
    readonly attempts: number;
    readonly failure: ReconciliationJobFailure;
  }): Promise<void>;
}
