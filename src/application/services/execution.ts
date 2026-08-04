import { Decimal } from "decimal.js";

import type { ObservationTrace } from "../contracts/observations.js";
import type { ChainObservationPort } from "../ports/chain.js";
import type { MarketObservationPort } from "../ports/market.js";
import type { PendingPositionAction, PositionWorkerCheckpoint } from "../ports/repositories.js";
import type {
  PositionActionDispatcherDependencies,
  PositionMonitoringFacts,
  PositionMonitoringFactsSource,
  PositionRuntimeActionDispatcher,
  PositionRuntimeStepSource,
} from "../ports/runtime.js";
import type { SwapFailure, SwapPort } from "../ports/swap.js";
import type { EvidenceReference } from "../../domain/shared/evidence.js";
import { InvariantViolationError } from "../../domain/shared/errors.js";
import { asBasisPoints, asNonNegativeDecimal, type ProviderId } from "../../domain/shared/types.js";
import type { PositionRuntimeStep } from "./position-monitor.js";

const EXIT_SLIPPAGE_BASIS_POINTS = asBasisPoints(150n);
const LAMPORTS_PER_SOL = new Decimal(1_000_000_000);

export type PositionStepFailureStage =
  "market_observation" | "chain_observation" | "quote" | "construction" | "simulation";

export class PositionStepUnavailableError extends Error {
  public constructor(
    public readonly stage: PositionStepFailureStage,
    public readonly code: string,
    public readonly retryable: boolean,
    message: string,
  ) {
    super(message);
    this.name = "PositionStepUnavailableError";
  }
}

function requireText(value: string, label: string): void {
  if (value.trim().length === 0) throw new InvariantViolationError(`${label} is required`);
}

function traceEvidence(trace: ObservationTrace): EvidenceReference {
  return Object.freeze({
    id: trace.evidenceId,
    provider: trace.provider,
    observedAt: trace.respondedAt,
    sourceKey: trace.sourceKey,
    ...(trace.slot === undefined ? {} : { slot: trace.slot }),
    contentHash: trace.contentHash,
  });
}

function uniqueEvidence(values: readonly EvidenceReference[]): readonly EvidenceReference[] {
  const byIdentity = new Map<string, EvidenceReference>();
  for (const value of values) {
    const identity = `${value.id}:${value.provider}:${value.sourceKey}:${value.contentHash ?? ""}`;
    if (!byIdentity.has(identity)) byIdentity.set(identity, Object.freeze({ ...value }));
  }
  return Object.freeze([...byIdentity.values()]);
}

function swapFailure(
  stage: Extract<PositionStepFailureStage, "quote" | "construction" | "simulation">,
  failure: SwapFailure,
): never {
  throw new PositionStepUnavailableError(stage, failure.code, failure.retryable, failure.reason);
}

function observationFailure(
  stage: Extract<PositionStepFailureStage, "market_observation" | "chain_observation">,
  failure: { readonly code: string; readonly retryable: boolean; readonly reason: string },
): never {
  throw new PositionStepUnavailableError(stage, failure.code, failure.retryable, failure.reason);
}

function validateFacts(facts: PositionMonitoringFacts): void {
  requireText(facts.stepId, "Position monitoring step ID");
  if (facts.observationRequestedAt > facts.evaluatedAt)
    throw new InvariantViolationError("Observation request cannot follow evaluation");
  if (facts.priorFullExitPriceImpactPercentages.length > 2)
    throw new InvariantViolationError("At most two prior full-exit impacts may be supplied");
  if (facts.evidence.some(({ observedAt }) => observedAt > facts.evaluatedAt))
    throw new InvariantViolationError("Persisted monitoring evidence cannot be from the future");
}

/**
 * Concrete deterministic step source. Provider calls are completed before a runtime step is
 * returned, so the worker can checkpoint the exact normalized facts and resulting action.
 */
export class ObservedPositionRuntimeStepSource implements PositionRuntimeStepSource {
  public constructor(
    private readonly facts: PositionMonitoringFactsSource,
    private readonly market: MarketObservationPort,
    private readonly chain: ChainObservationPort,
    private readonly swap: SwapPort,
  ) {}

  public async nextStep(checkpoint: PositionWorkerCheckpoint): Promise<PositionRuntimeStep> {
    const facts = await this.facts.loadFacts(checkpoint);
    validateFacts(facts);
    const position = checkpoint.runtimeState.lifecycle.position;
    if (position === null || position.id !== checkpoint.positionId)
      throw new InvariantViolationError("Position observation requires the checkpoint position");
    if (facts.positionId !== position.id || facts.tokenId !== position.tokenId)
      throw new InvariantViolationError("Monitoring facts target a different position or token");
    if (checkpoint.runtimeState.pendingExit !== null)
      throw new InvariantViolationError("Pending exits require reconciliation, not monitoring");

    const [marketResult, chainResult] = await Promise.all([
      this.market.observePrimaryPool(facts.tokenMint, facts.observationRequestedAt),
      this.chain.observeBalances(facts.wallet, facts.tokenMint, facts.observationRequestedAt),
    ]);
    if (!marketResult.ok) observationFailure("market_observation", marketResult.error);
    if (!chainResult.ok) observationFailure("chain_observation", chainResult.error);

    const quoteResult = await this.swap.quote({
      inputMint: facts.tokenMint,
      outputMint: facts.settlementMint,
      inputAmount: position.currentAmount,
      slippageBasisPoints: EXIT_SLIPPAGE_BASIS_POINTS,
      requestedAt: facts.observationRequestedAt,
    });
    if (!quoteResult.ok) swapFailure("quote", quoteResult.error);
    const quote = quoteResult.value;
    if (
      quote.inputMint !== facts.tokenMint ||
      quote.outputMint !== facts.settlementMint ||
      quote.inputAmount !== position.currentAmount ||
      quote.slippageBasisPoints !== EXIT_SLIPPAGE_BASIS_POINTS
    )
      throw new PositionStepUnavailableError(
        "quote",
        "validation",
        false,
        "Exit quote does not match the monitored position",
      );
    const quoteAge = new Date(facts.evaluatedAt).getTime() - new Date(quote.receivedAt).getTime();
    if (quoteAge < 0 || quoteAge > 2_000)
      throw new PositionStepUnavailableError(
        "quote",
        "expired",
        true,
        "Exit quote is not fresh at evaluation",
      );
    const constructionResult = await this.swap.construct({
      quote,
      wallet: facts.wallet,
      requestedAt: facts.observationRequestedAt,
    });
    if (!constructionResult.ok) swapFailure("construction", constructionResult.error);
    if (
      constructionResult.value.quoteFingerprint !== quote.fingerprint ||
      constructionResult.value.wallet !== facts.wallet
    )
      throw new PositionStepUnavailableError(
        "construction",
        "validation",
        false,
        "Constructed swap is not bound to the accepted quote and wallet",
      );
    const simulationResult = await this.swap.simulate(
      constructionResult.value,
      facts.observationRequestedAt,
    );
    if (!simulationResult.ok) swapFailure("simulation", simulationResult.error);
    const simulation = simulationResult.value;
    if (
      simulation.transactionFingerprint !== constructionResult.value.fingerprint ||
      simulation.result.succeeded !== true ||
      simulation.result.quoteFingerprint !== quote.fingerprint ||
      (quote.contextSlot !== null &&
        (simulation.result.contextSlot === null ||
          simulation.result.contextSlot < quote.contextSlot))
    )
      throw new PositionStepUnavailableError(
        "simulation",
        "simulation_failed",
        false,
        "Simulation is not current and bound to the constructed exit",
      );

    const marketEvidence = traceEvidence(marketResult.value.trace);
    const chainEvidence = chainResult.value.traces.map(traceEvidence);
    const evidence = uniqueEvidence([
      ...facts.evidence,
      marketEvidence,
      ...chainEvidence,
      ...quote.evidence,
      ...constructionResult.value.evidence,
      ...simulation.evidence,
    ]);
    if (evidence.length === 0)
      throw new InvariantViolationError("Position observation requires evidence");
    if (evidence.some(({ observedAt }) => observedAt > facts.evaluatedAt))
      throw new InvariantViolationError("Position observation evidence cannot be from the future");

    const currentImpact = quote.priceImpactPercentage;
    const impactHistory =
      currentImpact === null
        ? null
        : Object.freeze([
            ...facts.priorFullExitPriceImpactPercentages,
            asNonNegativeDecimal(currentImpact),
          ]);
    const executableValueSol = asNonNegativeDecimal(
      new Decimal(quote.expectedOutputAmount.toString()).div(LAMPORTS_PER_SOL),
    );
    const unexplainedBalanceDiscrepancy =
      chainResult.value.tokenBalanceRaw !== position.currentAmount;
    const provider: ProviderId = marketResult.value.trace.provider;
    if (provider !== "dexscreener" && provider !== "birdeye" && provider !== "gmgn")
      throw new InvariantViolationError("Market observation has an invalid provider identity");

    return Object.freeze({
      type: "monitor",
      stepId: facts.stepId,
      snapshot: Object.freeze({
        evaluatedAt: facts.evaluatedAt,
        executableValueSol,
        emergency: Object.freeze({
          evaluatedAt: facts.evaluatedAt,
          liquidityUsd: marketResult.value.liquidityUsd,
          liquidityUsdTenMinutesAgo: facts.liquidityUsdTenMinutesAgo,
          developerRelatedSoldPercentage: facts.developerRelatedSoldPercentage,
          originatingTierASoldPercentage: facts.originatingTierASoldPercentage,
          confirmingTierBSoldPercentages: facts.confirmingTierBSoldPercentages,
          dangerousSecurityChangeDetected: facts.dangerousSecurityChangeDetected,
          fullExitPriceImpactPercentages: impactHistory,
          unexplainedBalanceDiscrepancy,
          marketDataUnavailableSince: facts.marketDataUnavailableSince,
          marketDataAvailabilityKnown: true,
          allChainAccessUnavailableSince: facts.allChainAccessUnavailableSince,
          chainAccessAvailabilityKnown: true,
          evidence,
        }),
        evidence,
      }),
      preparation: Object.freeze({
        orderId: facts.orderId,
        quoteFingerprint: quote.fingerprint,
        quoteReceivedAt: quote.receivedAt,
        sellRouteValid: quote.routePlan.length > 0,
        simulationSucceeded: true,
        execution: Object.freeze({
          transactionFingerprint: constructionResult.value.fingerprint,
          quoteFingerprint: constructionResult.value.quoteFingerprint,
          quoteReceivedAt: quote.receivedAt,
          wallet: constructionResult.value.wallet,
          serializedTransactionBase64: constructionResult.value.serializedTransactionBase64,
          lastValidBlockHeight: constructionResult.value.lastValidBlockHeight,
          prioritizationFeeLamports: constructionResult.value.prioritizationFeeLamports,
          evidence: uniqueEvidence([...constructionResult.value.evidence, ...simulation.evidence]),
        }),
        evidence,
        peakEventId: facts.peakEventId,
        exitRequestedEventId: facts.exitRequestedEventId,
      }),
    });
  }
}

/** Executes only durable submit actions. Submission acknowledgement never implies confirmation. */
export class DurablePositionActionDispatcher implements PositionRuntimeActionDispatcher {
  private readonly completed = new Map<
    string,
    {
      fingerprint: string;
      receipt: Awaited<ReturnType<PositionActionDispatcherDependencies["submission"]["submit"]>>;
    }
  >();

  public constructor(private readonly dependencies: PositionActionDispatcherDependencies) {}

  public async dispatch(pending: PendingPositionAction) {
    if (pending.deliveryId.trim().length === 0)
      throw new InvariantViolationError("Pending action delivery ID is required");
    if (pending.action.type !== "submit_exit") return;
    const execution = pending.action.execution;
    const existing = this.completed.get(pending.deliveryId);
    if (existing !== undefined) {
      if (existing.fingerprint !== execution.transactionFingerprint)
        throw new InvariantViolationError(
          "Delivery ID was reused for a different exit transaction",
        );
      return existing.receipt;
    }
    const signingAt = this.dependencies.authority.now();
    const quoteAge = new Date(signingAt).getTime() - new Date(execution.quoteReceivedAt).getTime();
    if (quoteAge < 0 || quoteAge > 2_000)
      throw new InvariantViolationError("Exit quote is not fresh at signing");
    const publicIdentity = await this.dependencies.signer.publicIdentity();
    if (publicIdentity !== execution.wallet)
      throw new InvariantViolationError("Configured signer does not match prepared exit wallet");
    const inspected = await this.dependencies.inspector.inspect({
      serializedTransactionBase64: execution.serializedTransactionBase64,
      transactionFingerprint: execution.transactionFingerprint,
      expectedWallet: execution.wallet,
      currentBlockHeight: await this.dependencies.authority.currentBlockHeight(),
      lastValidBlockHeight: execution.lastValidBlockHeight,
      prioritizationFeeLamports: execution.prioritizationFeeLamports,
    });
    const signed = await this.dependencies.signer.sign(inspected);
    if (
      signed.wallet !== execution.wallet ||
      signed.unsignedTransactionFingerprint !== execution.transactionFingerprint
    )
      throw new InvariantViolationError("Signed transaction does not match inspected exit");
    const receipt = await this.dependencies.submission.submit(signed, pending.deliveryId);
    this.completed.set(pending.deliveryId, {
      fingerprint: execution.transactionFingerprint,
      receipt,
    });
    return receipt;
  }
}
