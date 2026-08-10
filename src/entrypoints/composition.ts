import type { Pool } from "pg";
import type {
  PositionWorkerCheckpoint,
  PositionWorkerCheckpointRepository,
} from "../application/ports/repositories.js";
import type {
  PositionRuntimeActionDispatcher,
  PositionRuntimeStepSource,
  ReconciliationEscalationPort,
} from "../application/ports/runtime.js";
import type { RuntimeConfig } from "../infrastructure/config/load-config.js";
import type { PositionId, Timestamp, WalletAddress } from "../domain/shared/types.js";
import {
  ObservedPositionRuntimeStepSource,
  DurablePositionActionDispatcher,
} from "../application/services/execution.js";
import { ObservedPositionReconciliationStepSource } from "../application/services/reconciliation.js";
import {
  PostgresPositionMonitoringFactsSource,
  PostgresPositionReconciliationFactsSource,
} from "../infrastructure/database/runtime-facts.js";
import { TransactionInspector } from "../infrastructure/security/transaction-inspector.js";
import { SolanaWireTransactionInspectionParser } from "../infrastructure/providers/solana/instruction-parser.js";
import {
  createRuntimeLogger,
  StructuredReconciliationEscalation,
} from "../infrastructure/runtime/escalation.js";
import { composeProductionProviders, type ProductionProviderServices } from "./providers.js";
import { PostgresReconciliationJobStore } from "../infrastructure/database/job-store.js";
import { PostgresPositionWorkerCheckpointRepository } from "../infrastructure/database/repositories.js";
import { PostgresPositionObservationStore } from "../infrastructure/database/position-observations.js";
import { PostgresPositionRuntimeAuthorityRepository } from "../infrastructure/database/runtime-authority.js";
import { PostgresRuntimeAuthorityBaselineSource } from "../infrastructure/database/runtime-authority-baselines.js";
import { PostgresPositionRuntimeFactPublisher } from "../infrastructure/database/runtime-facts.js";
import { runLivePositionRuntimeFactCycle } from "../application/services/runtime-fact-publisher.js";
import { RuntimeFactFragmentProducer } from "../application/services/runtime-fact-producers.js";
import {
  AuthoritativeRuntimeFactSnapshotSource,
  LiveChainRuntimeFactSource,
  LiveMarketRuntimeFactSource,
} from "../application/services/live-runtime-fact-sources.js";
import { SystemSchedulerClock } from "../infrastructure/runtime/system-clock.js";
import { runReconciliationWorkerCycle } from "../workers/reconciliation-worker.js";
import type { PositionJobSupervisorDependencies } from "../workers/supervisor.js";
import {
  produceMonitoringRuntimeAuthority,
  produceReconciliationRuntimeAuthority,
} from "../application/services/runtime-authority-production.js";
import {
  LiveMonitoringRuntimeAuthorityInputSource,
  LiveReconciliationRuntimeAuthorityInputSource,
} from "../application/services/live-runtime-authority-inputs.js";
import { LiveCandidateDiscoverySource } from "../application/services/discovery.js";
import { PostgresCandidateDiscoveryRepository } from "../infrastructure/database/candidate-discovery.js";
import { runDiscoveryWorkerCycle } from "../workers/discovery-worker.js";
import { asStrategyVersionId, asTimestamp } from "../domain/shared/types.js";
import { runTrackedWalletObservationCycle } from "../application/services/tracked-wallet-observations.js";
import { runTrackedWalletValuationCycle } from "../application/services/tracked-wallet-valuations.js";
import { PostgresTrackedWalletObservationRepository } from "../infrastructure/database/tracked-wallet-observations.js";
import { PostgresTrackedWalletValuationRepository } from "../infrastructure/database/tracked-wallet-valuations.js";
import { PostgresCandidateEvaluationWorkQueue } from "../infrastructure/database/candidate-evaluation-jobs.js";
import { PostgresCandidateEvaluationRepository } from "../infrastructure/database/candidate-evaluations.js";
import { PostgresCandidateWalletPurchaseSource } from "../infrastructure/database/candidate-wallet-confirmations.js";
import { PostgresWalletIntelligenceRepository } from "../infrastructure/database/wallet-intelligence.js";
import { runLeasedCandidateEvaluationCycle } from "../application/services/candidate-evaluation-work.js";
import {
  deterministicSignalId,
  LiveCandidateEvaluationFactSource,
} from "../application/services/live-candidate-evaluation-facts.js";
import type { PortfolioOperationalSafetySource } from "../application/services/live-portfolio-accounting-observation.js";
import { LivePortfolioAccountingObservationSource } from "../application/services/live-portfolio-accounting-observation.js";
import { LivePortfolioInventoryValuationSource } from "../application/services/portfolio-inventory-valuation.js";
import { PostgresPortfolioTransactionHistorySource } from "../infrastructure/database/portfolio-transaction-history.js";
import { PostgresPortfolioAccountingLedger } from "../infrastructure/database/portfolio-accounting.js";
import { PostgresProviderDisagreementAuthority } from "../infrastructure/database/operational-safety-facts.js";
import { PostgresReconciliationFailureFactSource } from "../infrastructure/database/operational-safety-facts.js";
import { PostgresOpenPositionInventorySource } from "../infrastructure/database/open-position-inventory.js";
import { LiveOpenPositionExecutableValuationSource } from "../application/services/open-position-executable-valuation.js";
import { LivePortfolioOperationalSafetyInputSource } from "../application/services/live-operational-safety-sources.js";
import { producePortfolioOperationalSafety } from "../application/services/portfolio-operational-safety-production.js";
import { PostgresPortfolioOperationalSafetyAuthority } from "../infrastructure/database/portfolio-operational-safety.js";
import {
  LivePortfolioCheckpointPublicationCycle,
  type PortfolioCheckpointPublicationCycle,
} from "../application/services/portfolio-checkpoint-publication.js";

export interface CompletedPositionServices {
  readonly steps: PositionRuntimeStepSource;
  readonly actions: PositionRuntimeActionDispatcher;
  readonly escalation: ReconciliationEscalationPort;
  readonly beforeCycle?: (positionId: PositionId) => Promise<void>;
}
export interface PositionRuntimeComposition {
  readonly checkpoints: PositionWorkerCheckpointRepository;
  readonly supervisor: PositionJobSupervisorDependencies;
}

export interface CompletePortfolioPublicationCycle {
  publish(observedAt: Timestamp): Promise<void>;
}

/** Composes operational-safety production immediately before the matching accounting checkpoint. */
export function composeCompletePortfolioPublication(input: {
  readonly database: Pool;
  readonly providers: Pick<
    ProductionProviderServices,
    "inventory" | "market" | "walletHistory" | "swap"
  >;
  readonly wallet: WalletAddress;
}): CompletePortfolioPublicationCycle {
  const operations = new PostgresPortfolioOperationalSafetyAuthority(input.database, input.wallet);
  const operationalSource = new LivePortfolioOperationalSafetyInputSource(
    input.wallet,
    new LiveOpenPositionExecutableValuationSource(
      input.wallet,
      new PostgresOpenPositionInventorySource(
        input.database,
        input.providers.inventory,
        input.wallet,
      ),
      input.providers.swap,
    ),
    new PostgresReconciliationFailureFactSource(input.database, input.wallet),
    new PostgresProviderDisagreementAuthority(input.database, input.wallet),
  );
  const checkpoints = composeProductionPortfolioCheckpointPublication({ ...input, operations });
  return Object.freeze({
    publish: async (observedAt: Timestamp) => {
      await producePortfolioOperationalSafety({
        wallet: input.wallet,
        observedAt,
        source: operationalSource,
        sink: operations,
      });
      await checkpoints.publish(observedAt);
    },
  });
}

/** Composes complete live accounting acquisition with immutable checkpoint publication. */
export function composeProductionPortfolioCheckpointPublication(input: {
  readonly database: Pool;
  readonly providers: Pick<ProductionProviderServices, "inventory" | "market" | "walletHistory">;
  readonly wallet: WalletAddress;
  readonly operations: PortfolioOperationalSafetySource;
}): PortfolioCheckpointPublicationCycle {
  const valuation = new LivePortfolioInventoryValuationSource(
    input.wallet,
    input.providers.inventory,
    input.providers.market,
  );
  const transactions = new PostgresPortfolioTransactionHistorySource(
    input.database,
    input.providers.walletHistory,
    input.wallet,
  );
  const source = new LivePortfolioAccountingObservationSource(
    input.wallet,
    valuation,
    transactions,
    input.operations,
  );
  return new LivePortfolioCheckpointPublicationCycle(
    source,
    new PostgresPortfolioAccountingLedger(input.database),
  );
}

/** Composes concrete runtime/database infrastructure around validated provider services. */
export function composePositionRuntime(input: {
  readonly config: RuntimeConfig;
  readonly database: Pool;
  readonly services: CompletedPositionServices;
  readonly signal: AbortSignal;
}): PositionRuntimeComposition {
  if (input.config.execution === null)
    throw new Error("Position execution runtime requires an execution-enabled operating mode");
  const clock = new SystemSchedulerClock();
  const jobs = new PostgresReconciliationJobStore(input.database);
  const checkpoints = new PostgresPositionWorkerCheckpointRepository(input.database);
  const worker = {
    checkpoints,
    steps: input.services.steps,
    actions: input.services.actions,
    jobs,
    escalation: input.services.escalation,
    ownerId: input.config.instanceId,
    now: () => clock.now(),
    ...(input.services.beforeCycle === undefined
      ? {}
      : { beforeCycle: input.services.beforeCycle }),
  };
  return Object.freeze({
    checkpoints,
    supervisor: Object.freeze({
      jobs,
      now: () => clock.now(),
      run: (positionId: PositionId) => runReconciliationWorkerCycle(positionId, worker),
      wait: clock,
      signal: input.signal,
    }),
  });
}

/** Builds the completed production position subsystem without preconstructed application services. */
export function composeProductionPositionRuntime(input: {
  readonly config: RuntimeConfig;
  readonly database: Pool;
  readonly signal: AbortSignal;
}): PositionRuntimeComposition {
  if (input.config.execution === null)
    throw new Error("Production position runtime requires execution configuration");
  const providers = composeProductionProviders(
    input.config,
    new PostgresProviderDisagreementAuthority(input.database),
  );
  const clock = new SystemSchedulerClock();
  const discoverySource = new LiveCandidateDiscoverySource({
    provider: providers.discovery,
    strategyVersionId: asStrategyVersionId("strategy-v1.0.0"),
    now: () => clock.now(),
    deduplicationWindow: (at) => asTimestamp(at).slice(0, 16),
  });
  const discoveryCandidates = new PostgresCandidateDiscoveryRepository(input.database);
  const trackedWalletObservations = new PostgresTrackedWalletObservationRepository(input.database);
  const trackedWalletValuations = new PostgresTrackedWalletValuationRepository(input.database);
  const evaluationQueue = new PostgresCandidateEvaluationWorkQueue(input.database);
  const evaluationRepository = new PostgresCandidateEvaluationRepository(input.database);
  const evaluationFacts = new LiveCandidateEvaluationFactSource(
    providers.market,
    providers.mintSecurity,
    new PostgresCandidateWalletPurchaseSource(input.database),
    new PostgresWalletIntelligenceRepository(input.database),
    () => clock.now(),
  );
  const publisherCheckpoints = new PostgresPositionWorkerCheckpointRepository(input.database);
  const observations = new PostgresPositionObservationStore(input.database);
  const publications = new PostgresPositionRuntimeFactPublisher(input.database);
  const authority = new PostgresPositionRuntimeAuthorityRepository(input.database);
  const baselines = new PostgresRuntimeAuthorityBaselineSource(input.database);
  const monitoringAuthority = new LiveMonitoringRuntimeAuthorityInputSource(
    baselines,
    providers.balances,
    providers.mintSecurity,
  );
  const reconciliationAuthority = new LiveReconciliationRuntimeAuthorityInputSource(
    baselines,
    providers.transactions,
  );
  const producer = new RuntimeFactFragmentProducer(observations);
  const marketFacts = new LiveMarketRuntimeFactSource(authority, providers.market);
  const chainFacts = new LiveChainRuntimeFactSource(authority, providers.balances);
  const walletFacts = new AuthoritativeRuntimeFactSnapshotSource(
    authority.source("wallet", "solana_rpc"),
  );
  const securityFacts = new AuthoritativeRuntimeFactSnapshotSource(
    authority.source("security", "solana_rpc"),
  );
  const executionFacts = new AuthoritativeRuntimeFactSnapshotSource(
    authority.source("execution", "solana_rpc"),
  );
  const monitoring = new ObservedPositionRuntimeStepSource(
    new PostgresPositionMonitoringFactsSource(input.database),
    providers.market,
    providers.balances,
    providers.swap,
  );
  const reconciliation = new ObservedPositionReconciliationStepSource(
    new PostgresPositionReconciliationFactsSource(input.database),
    providers.transactions,
    providers.balances,
  );
  const steps: PositionRuntimeStepSource = Object.freeze({
    nextStep: (checkpoint: PositionWorkerCheckpoint) =>
      checkpoint.runtimeState.pendingExit === null
        ? monitoring.nextStep(checkpoint)
        : reconciliation.nextStep(checkpoint),
  });
  const policy = input.config.execution;
  const actions = new DurablePositionActionDispatcher({
    inspector: new TransactionInspector(new SolanaWireTransactionInspectionParser(), {
      allowedProgramIds: policy.allowedProgramIds,
      allowedFeeRecipients: policy.allowedFeeRecipients,
      allowedDestinationOwners: policy.allowedDestinationOwners,
      maximumPrioritizationFeeLamports: policy.maximumPrioritizationFeeLamports as never,
    }),
    signer: providers.signer,
    submission: providers.submission,
    authority: providers.authority,
  });
  const runtime = composePositionRuntime({
    ...input,
    services: Object.freeze({
      steps,
      actions,
      escalation: new StructuredReconciliationEscalation(
        createRuntimeLogger(input.config.logLevel),
      ),
      beforeCycle: async (positionId: PositionId) => {
        const checkpoint = await publisherCheckpoints.load(positionId);
        const observedAt = clock.now();
        if (checkpoint.runtimeState.pendingExit === null) {
          await produceMonitoringRuntimeAuthority({
            checkpoint,
            observedAt,
            source: monitoringAuthority,
            sink: authority,
          });
        } else {
          await produceReconciliationRuntimeAuthority({
            checkpoint,
            observedAt,
            source: reconciliationAuthority,
            sink: authority,
          });
        }
        await runLivePositionRuntimeFactCycle(positionId, {
          checkpoints: publisherCheckpoints,
          observations,
          publications,
          producer,
          monitoringSources: Object.freeze([
            marketFacts,
            chainFacts,
            walletFacts,
            securityFacts,
            executionFacts,
          ]),
          reconciliationSources: Object.freeze([chainFacts, executionFacts]),
          now: () => observedAt,
        });
      },
    }),
  });
  return Object.freeze({
    ...runtime,
    supervisor: Object.freeze({
      ...runtime.supervisor,
      beforeBatch: async () => {
        await runDiscoveryWorkerCycle({
          source: discoverySource,
          candidates: discoveryCandidates,
        });
        await runTrackedWalletObservationCycle({
          source: providers.trackedWalletPurchases,
          repository: trackedWalletObservations,
          now: () => clock.now(),
        });
        await runTrackedWalletValuationCycle({
          repository: trackedWalletValuations,
          market: providers.market,
          balances: providers.balances,
          now: () => clock.now(),
          limit: 100,
        });
        await runLeasedCandidateEvaluationCycle({
          queue: evaluationQueue,
          facts: evaluationFacts,
          repository: evaluationRepository,
          ownerId: input.config.instanceId,
          now: () => clock.now(),
          leaseExpiresAt: (at) => asTimestamp(new Date(Date.parse(at) + 60_000)),
          retryAt: (at) => asTimestamp(new Date(Date.parse(at) + 10_000)),
          signalId: deterministicSignalId,
          batchSize: 25,
        });
      },
    }),
  });
}
