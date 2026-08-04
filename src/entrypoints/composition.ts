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
import type { PositionId } from "../domain/shared/types.js";
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
import { composeProductionProviders } from "./providers.js";
import { PostgresReconciliationJobStore } from "../infrastructure/database/job-store.js";
import { PostgresPositionWorkerCheckpointRepository } from "../infrastructure/database/repositories.js";
import { PostgresPositionObservationStore } from "../infrastructure/database/position-observations.js";
import { PostgresPositionRuntimeFactPublisher } from "../infrastructure/database/runtime-facts.js";
import { runPositionRuntimeFactPublisherCycle } from "../application/services/runtime-fact-publisher.js";
import { SystemSchedulerClock } from "../infrastructure/runtime/system-clock.js";
import { runReconciliationWorkerCycle } from "../workers/reconciliation-worker.js";
import type { PositionJobSupervisorDependencies } from "../workers/supervisor.js";

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
  const providers = composeProductionProviders(input.config);
  const clock = new SystemSchedulerClock();
  const publisherCheckpoints = new PostgresPositionWorkerCheckpointRepository(input.database);
  const observations = new PostgresPositionObservationStore(input.database);
  const publications = new PostgresPositionRuntimeFactPublisher(input.database);
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
  return composePositionRuntime({
    ...input,
    services: Object.freeze({
      steps,
      actions,
      escalation: new StructuredReconciliationEscalation(
        createRuntimeLogger(input.config.logLevel),
      ),
      beforeCycle: async (positionId: PositionId) =>
        void (await runPositionRuntimeFactPublisherCycle(positionId, {
          checkpoints: publisherCheckpoints,
          observations,
          publications,
          now: () => clock.now(),
        })),
    }),
  });
}
