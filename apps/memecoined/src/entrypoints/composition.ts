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
import {
  composePaperProviders,
  composeProductionProviders,
  type PaperProviderServices,
  type ProductionProviderServices,
} from "./providers.js";
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
import { runScheduledAcquisitionCycle } from "../application/services/acquisition-schedule.js";
import { PostgresAcquisitionSchedule } from "../infrastructure/database/acquisition-schedule.js";
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
import { runScheduledPortfolioProductionCycle } from "../application/services/portfolio-production-schedule.js";
import { PostgresPortfolioProductionSchedule } from "../infrastructure/database/portfolio-production-schedule.js";
import { PostgresRiskEvaluationWorkQueue } from "../infrastructure/database/risk-evaluation-jobs.js";
import { PostgresRiskAuthorityRepository } from "../infrastructure/database/risk-authority.js";
import { PostgresRiskDecisionRepository } from "../infrastructure/database/risk-decisions.js";
import { runLeasedRiskEvaluationCycle } from "../application/services/risk-evaluation-work.js";
import { initializePaperAccount } from "../application/services/paper-deployment.js";
import {
  PaperQuoteExecutionService,
  runPaperEntryExecutionCycle,
} from "../application/services/paper-execution.js";
import { PostgresPaperAccountingLedger } from "../infrastructure/database/paper-accounting.js";
import { PostgresPaperRiskAuthoritySource } from "../infrastructure/database/paper-risk-authority.js";
import { ensureAllProfilesPaperTrialPreset } from "../infrastructure/database/paper-profile-activations.js";
import { runProfilePaperSimulationCycle } from "../application/services/profile-paper-simulation.js";
import { PostgresPaperEntryWorkQueue } from "../infrastructure/database/paper-entry-work.js";
import { PostgresPaperPositionWorkQueue } from "../infrastructure/database/paper-position-work.js";
import { PostgresPaperExitAuthority } from "../infrastructure/database/paper-exit-authority.js";
import { AuthoritativePaperExitMonitor } from "../application/services/paper-exit-authority.js";
import { runPaperPositionMonitorCycle } from "../application/services/paper-position-monitor.js";
import { OperatorApprovalService } from "../application/services/operator-approval.js";
import { TelegramOperatorCycle } from "../application/services/telegram-operator.js";
import { PostgresOperatorApprovalStore } from "../infrastructure/database/operator-approvals.js";
import { PostgresTelegramUpdateLedger } from "../infrastructure/database/telegram-operator.js";
import { PostgresOperatorRuntimeControl } from "../infrastructure/database/operator-runtime-control.js";
import { TelegramBotApi } from "../infrastructure/providers/telegram/bot-api.js";
import { prepareLiveEntryForHumanApproval } from "../application/services/live-entry-preparation.js";
import { PostgresLiveEntryPlanningSource } from "../infrastructure/database/live-entry-planning.js";
import { PostgresEntryPreparationRepository } from "../infrastructure/database/entry-preparations.js";
import { PostgresPreparedEntryExecutionSource } from "../infrastructure/database/prepared-entry-executions.js";
import { PostgresEntrySubmissionRepository } from "../infrastructure/database/entry-submissions.js";
import { runEntrySubmissionWorkerCycle } from "../workers/entry-worker.js";
import { reconcileLiveEntry } from "../application/services/live-entry-reconciliation.js";
import { PostgresLiveEntryReconciliationSource } from "../infrastructure/database/live-entry-reconciliation.js";

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

function composeTelegramOperator(
  config: RuntimeConfig,
  database: Pool,
  clock: SystemSchedulerClock,
  control: PostgresOperatorRuntimeControl,
  approvals: OperatorApprovalService,
): TelegramOperatorCycle | null {
  if (config.telegram === null) return null;
  return new TelegramOperatorCycle(
    new TelegramBotApi(config.telegram.botToken),
    new PostgresTelegramUpdateLedger(database),
    approvals,
    config.telegram.operatorUserIds,
    config.telegram.chatId,
    async () =>
      `MemeCoined'Ed is running in ${config.mode} mode. New entries are ${(await control.entryBlocked()) ? "blocked" : "enabled"}.`,
    (actorId) => control.stop(actorId, clock.now()),
  );
}

/** Composes the non-capital paper worker with no live-position execution path. */
export function composePaperTradingRuntime(input: {
  readonly config: RuntimeConfig;
  readonly database: Pool;
  readonly signal: AbortSignal;
  readonly providers?: PaperProviderServices;
}): PositionRuntimeComposition {
  if (input.config.paper === null || input.config.execution !== null)
    throw new Error("Paper trading runtime requires paper-only configuration");
  const clock = new SystemSchedulerClock();
  const providers = input.providers ?? composePaperProviders(input.config);
  const wallet = input.config.paper.walletAddress as WalletAddress;
  const ledger = new PostgresPaperAccountingLedger(input.database);
  const operatorControl = new PostgresOperatorRuntimeControl(input.database);
  const approvalStore = new PostgresOperatorApprovalStore(input.database);
  const approvalService = new OperatorApprovalService(approvalStore, () => clock.now());
  const telegram = composeTelegramOperator(
    input.config,
    input.database,
    clock,
    operatorControl,
    approvalService,
  );
  const queue = new PostgresPaperEntryWorkQueue(input.database);
  const riskQueue = new PostgresRiskEvaluationWorkQueue(input.database);
  const riskFacts = new PostgresPaperRiskAuthoritySource(
    input.database,
    wallet,
    providers.swap,
    () => clock.now(),
  );
  const riskDecisions = new PostgresRiskDecisionRepository(input.database);
  const positionQueue = new PostgresPaperPositionWorkQueue(input.database, wallet);
  const discoverySource = new LiveCandidateDiscoverySource({
    provider: providers.discovery,
    strategyVersionId: asStrategyVersionId("strategy-v1.0.0"),
    now: () => clock.now(),
    deduplicationWindow: (at) => asTimestamp(at).slice(0, 16),
  });
  const discoveryCandidates = new PostgresCandidateDiscoveryRepository(input.database);
  const acquisitionSchedule = new PostgresAcquisitionSchedule(input.database);
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
  const execution = new PaperQuoteExecutionService(
    wallet,
    providers.swap,
    ledger,
    () => clock.now(),
    input.config.paper.executionFeeLamports,
  );
  let initialized = false;
  const noPositionJobs = Object.freeze({
    recoverAbandoned: async () => Object.freeze([]),
    findDue: async () => Object.freeze([]),
  });
  return Object.freeze({
    checkpoints: new PostgresPositionWorkerCheckpointRepository(input.database),
    supervisor: Object.freeze({
      jobs: noPositionJobs,
      now: () => clock.now(),
      run: async () => {
        throw new Error("Paper runtime cannot execute live position jobs");
      },
      wait: clock,
      signal: input.signal,
      beforeBatch: async () => {
        await telegram?.run();
        if (!initialized) {
          await initializePaperAccount({
            wallet,
            initialCashLamports: input.config.paper!.initialCashLamports,
            initializedAt: clock.now(),
            ledger,
          });
          if (input.config.paper!.trialPreset === "all_profiles")
            await ensureAllProfilesPaperTrialPreset(input.database, wallet, new Date(clock.now()));
          initialized = true;
        }
        if (!(await operatorControl.entryBlocked()))
          await runScheduledAcquisitionCycle({
            schedule: acquisitionSchedule,
            ownerId: input.config.instanceId,
            now: () => clock.now(),
            leaseExpiresAt: (at) => asTimestamp(new Date(Date.parse(at) + 180_000)),
            nextAvailableAt: (at) => asTimestamp(new Date(Date.parse(at) + 30_000)),
            retryAt: (at) => asTimestamp(new Date(Date.parse(at) + 10_000)),
            discover: () =>
              runDiscoveryWorkerCycle({ source: discoverySource, candidates: discoveryCandidates }),
            observeWallets: () =>
              runTrackedWalletObservationCycle({
                source: providers.trackedWalletPurchases,
                repository: trackedWalletObservations,
                now: () => clock.now(),
              }),
            valueWallets: () =>
              runTrackedWalletValuationCycle({
                repository: trackedWalletValuations,
                market: providers.market,
                balances: providers.balances,
                now: () => clock.now(),
                limit: 100,
              }),
            evaluateCandidates: () =>
              runLeasedCandidateEvaluationCycle({
                queue: evaluationQueue,
                facts: evaluationFacts,
                repository: evaluationRepository,
                ownerId: input.config.instanceId,
                now: () => clock.now(),
                leaseExpiresAt: (at) => asTimestamp(new Date(Date.parse(at) + 60_000)),
                retryAt: (at) => asTimestamp(new Date(Date.parse(at) + 10_000)),
                signalId: deterministicSignalId,
                // Paper evaluation uses the same bounded throughput as supervised
                // production. Both configured RPC routes are independently validated
                // private providers, so the queue can drain without weakening any
                // mint-security or evidence requirement.
                batchSize: 25,
              }),
            publishPortfolioAndEvaluateRisk: () =>
              runLeasedRiskEvaluationCycle({
                queue: riskQueue,
                facts: riskFacts,
                repository: riskDecisions,
                ownerId: input.config.instanceId,
                now: () => clock.now(),
                leaseExpiresAt: (at) => asTimestamp(new Date(Date.parse(at) + 60_000)),
                retryAt: (at) => asTimestamp(new Date(Date.parse(at) + 10_000)),
                batchSize: 25,
              }),
          });
        if (!(await operatorControl.entryBlocked()))
          await runPaperEntryExecutionCycle({
            queue,
            execution,
            ownerId: input.config.instanceId,
            now: () => clock.now(),
            leaseExpiresAt: (at) => asTimestamp(new Date(Date.parse(at) + 60_000)),
            retryAt: (at) => asTimestamp(new Date(Date.parse(at) + 10_000)),
            batchSize: 25,
          });
        await runPaperPositionMonitorCycle({
          queue: positionQueue,
          monitor: new AuthoritativePaperExitMonitor(
            new PostgresPaperExitAuthority(input.database, wallet, providers.swap, () =>
              clock.now(),
            ),
          ),
          execution,
          ownerId: input.config.instanceId,
          now: () => clock.now(),
          leaseExpiresAt: (at) => asTimestamp(new Date(Date.parse(at) + 60_000)),
          nextAt: (at) => asTimestamp(new Date(Date.parse(at) + 30_000)),
          retryAt: (at) => asTimestamp(new Date(Date.parse(at) + 10_000)),
          batchSize: 25,
        });
        if (!(await operatorControl.entryBlocked()))
          await runProfilePaperSimulationCycle({
            database: input.database,
            swap: providers.swap,
            wallet,
            now: () => clock.now(),
            executionFeeRaw: input.config.paper!.executionFeeLamports,
          });
      },
    }),
  });
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
  const acquisitionSchedule = new PostgresAcquisitionSchedule(input.database);
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
  const portfolioSchedule = new PostgresPortfolioProductionSchedule(input.database);
  const riskQueue = new PostgresRiskEvaluationWorkQueue(input.database);
  const riskAuthority = new PostgresRiskAuthorityRepository(input.database);
  const riskDecisions = new PostgresRiskDecisionRepository(input.database);
  const operatorControl = new PostgresOperatorRuntimeControl(input.database);
  const approvalStore = new PostgresOperatorApprovalStore(input.database);
  const approvalService = new OperatorApprovalService(approvalStore, () => clock.now());
  const telegram = composeTelegramOperator(
    input.config,
    input.database,
    clock,
    operatorControl,
    approvalService,
  );
  let liveEntryPlanning: Promise<PostgresLiveEntryPlanningSource> | undefined;
  if (input.config.liveTrial === null)
    throw new Error("Live execution requires explicit low-value trial authorization");
  const entryPlanning = () =>
    (liveEntryPlanning ??= providers.signer.publicIdentity().then((wallet) => {
      if (wallet !== input.config.liveTrial!.wallet)
        throw new Error("Configured trial wallet does not match the signing wallet");
      return new PostgresLiveEntryPlanningSource(
        input.database,
        wallet,
        input.config.liveTrial!.maximumLamports,
      );
    }));
  const entryPreparations = new PostgresEntryPreparationRepository(input.database);
  const preparedEntries = new PostgresPreparedEntryExecutionSource(input.database);
  const entrySubmissions = new PostgresEntrySubmissionRepository(input.database);
  const entryReconciliations = new PostgresLiveEntryReconciliationSource(input.database);
  const entryInspector = new TransactionInspector(new SolanaWireTransactionInspectionParser(), {
    allowedProgramIds: input.config.execution.allowedProgramIds,
    allowedFeeRecipients: input.config.execution.allowedFeeRecipients,
    allowedDestinationOwners: input.config.execution.allowedDestinationOwners,
    maximumPrioritizationFeeLamports: input.config.execution
      .maximumPrioritizationFeeLamports as never,
  });
  let portfolioPublication: Promise<CompletePortfolioPublicationCycle> | undefined;
  const publication = () =>
    (portfolioPublication ??= providers.signer.publicIdentity().then((wallet) =>
      composeCompletePortfolioPublication({
        database: input.database,
        providers,
        wallet,
      }),
    ));
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
        await telegram?.run();
        if (!(await operatorControl.entryBlocked()))
          await runScheduledAcquisitionCycle({
            schedule: acquisitionSchedule,
            ownerId: input.config.instanceId,
            now: () => clock.now(),
            leaseExpiresAt: (at) => asTimestamp(new Date(Date.parse(at) + 180_000)),
            nextAvailableAt: (at) => asTimestamp(new Date(Date.parse(at) + 30_000)),
            retryAt: (at) => asTimestamp(new Date(Date.parse(at) + 10_000)),
            discover: () =>
              runDiscoveryWorkerCycle({ source: discoverySource, candidates: discoveryCandidates }),
            observeWallets: () =>
              runTrackedWalletObservationCycle({
                source: providers.trackedWalletPurchases,
                repository: trackedWalletObservations,
                now: () => clock.now(),
              }),
            valueWallets: () =>
              runTrackedWalletValuationCycle({
                repository: trackedWalletValuations,
                market: providers.market,
                balances: providers.balances,
                now: () => clock.now(),
                limit: 100,
              }),
            evaluateCandidates: () =>
              runLeasedCandidateEvaluationCycle({
                queue: evaluationQueue,
                facts: evaluationFacts,
                repository: evaluationRepository,
                ownerId: input.config.instanceId,
                now: () => clock.now(),
                leaseExpiresAt: (at) => asTimestamp(new Date(Date.parse(at) + 60_000)),
                retryAt: (at) => asTimestamp(new Date(Date.parse(at) + 10_000)),
                signalId: deterministicSignalId,
                batchSize: 25,
              }),
            publishPortfolioAndEvaluateRisk: async () => {
              const result = await runScheduledPortfolioProductionCycle({
                schedule: portfolioSchedule,
                ownerId: input.config.instanceId,
                now: () => clock.now(),
                leaseExpiresAt: (at) => asTimestamp(new Date(Date.parse(at) + 120_000)),
                nextAvailableAt: (at) => asTimestamp(new Date(Date.parse(at) + 30_000)),
                retryAt: (at) => asTimestamp(new Date(Date.parse(at) + 10_000)),
                publish: async (observedAt) => (await publication()).publish(observedAt),
                evaluateRisk: () =>
                  runLeasedRiskEvaluationCycle({
                    queue: riskQueue,
                    facts: riskAuthority,
                    repository: riskDecisions,
                    ownerId: input.config.instanceId,
                    now: () => clock.now(),
                    leaseExpiresAt: (at) => asTimestamp(new Date(Date.parse(at) + 60_000)),
                    retryAt: (at) => asTimestamp(new Date(Date.parse(at) + 10_000)),
                    batchSize: 25,
                  }),
              });
              if (result.status === "retry_scheduled")
                throw new Error("Portfolio and risk acquisition was rescheduled");
              return result.evaluated;
            },
          });
        if (!(await operatorControl.entryBlocked())) {
          if (telegram === null)
            throw new Error("Supervised live entry preparation requires an operator channel");
          for (const work of await (await entryPlanning()).nextBatch(25))
            await prepareLiveEntryForHumanApproval({
              work,
              swap: providers.swap,
              signer: providers.signer,
              repository: entryPreparations,
              approvals: approvalService,
              notify: (message) => telegram.notify(message),
              now: () => clock.now(),
            });
          await runEntrySubmissionWorkerCycle({
            source: preparedEntries,
            repository: entrySubmissions,
            inspector: entryInspector,
            signer: providers.signer,
            submission: providers.submission,
            authority: providers.authority,
            approvals: approvalStore,
            batchSize: 25,
          });
          for (const work of await entryReconciliations.nextBatch(25))
            await reconcileLiveEntry({
              work,
              transactions: providers.transactions,
              balances: providers.balances,
              security: providers.mintSecurity,
              positions: publisherCheckpoints,
              now: () => clock.now(),
            });
        }
      },
    }),
  });
}
