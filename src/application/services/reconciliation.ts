import type { ObservationTrace } from "../contracts/observations.js";
import type { ChainObservationPort, ChainTransactionObservationPort } from "../ports/chain.js";
import type {
  PositionReconciliationFactsSource,
  PositionRuntimeStepSource,
} from "../ports/runtime.js";
import type { PositionWorkerCheckpoint } from "../ports/repositories.js";
import type { EvidenceReference } from "../../domain/shared/evidence.js";
import { InvariantViolationError } from "../../domain/shared/errors.js";
import { asRawAmount } from "../../domain/shared/types.js";
import type { PositionRuntimeStep } from "./position-monitor.js";

export class PositionReconciliationUnavailableError extends Error {
  public constructor(
    public readonly stage: "transaction" | "balance",
    public readonly code: string,
    public readonly retryable: boolean,
    message: string,
  ) {
    super(message);
    this.name = "PositionReconciliationUnavailableError";
  }
}

function evidence(trace: ObservationTrace): EvidenceReference {
  return Object.freeze({
    id: trace.evidenceId,
    provider: trace.provider,
    observedAt: trace.respondedAt,
    sourceKey: trace.sourceKey,
    ...(trace.slot === undefined ? {} : { slot: trace.slot }),
    contentHash: trace.contentHash,
  });
}

/** Builds reconciliation only from the acknowledged signature and authoritative RPC deltas. */
export class ObservedPositionReconciliationStepSource implements PositionRuntimeStepSource {
  public constructor(
    private readonly facts: PositionReconciliationFactsSource,
    private readonly transactions: ChainTransactionObservationPort,
    private readonly balances: ChainObservationPort,
  ) {}

  public async nextStep(checkpoint: PositionWorkerCheckpoint): Promise<PositionRuntimeStep> {
    const pending = checkpoint.runtimeState.pendingExit;
    if (pending === null || pending.submission === null)
      throw new InvariantViolationError("Reconciliation requires an acknowledged exit submission");
    const position = checkpoint.runtimeState.lifecycle.position;
    if (
      position === null ||
      position.id !== checkpoint.positionId ||
      position.state !== "exit_pending"
    )
      throw new InvariantViolationError("Reconciliation requires the exit-pending position");
    const facts = await this.facts.loadFacts(checkpoint);
    if (facts.stepId.trim().length === 0)
      throw new InvariantViolationError("Reconciliation step ID is required");
    if (facts.observationRequestedAt > facts.evaluatedAt)
      throw new InvariantViolationError("Reconciliation request cannot follow evaluation");

    const transactionResult = await this.transactions.observeTransaction(
      pending.submission.signature,
      facts.wallet,
      facts.tokenMint,
      facts.observationRequestedAt,
    );
    if (!transactionResult.ok)
      throw new PositionReconciliationUnavailableError(
        "transaction",
        transactionResult.error.code,
        transactionResult.error.retryable,
        transactionResult.error.reason,
      );
    const transaction = transactionResult.value;
    const transactionEvidence = transaction.traces.map(evidence);
    if (transaction.state !== "confirmed")
      return Object.freeze({
        type: "reconcile",
        stepId: facts.stepId,
        eventId: facts.eventId,
        reconciliation: Object.freeze({
          evaluatedAt: facts.evaluatedAt,
          transactionConfirmed: transaction.state === "failed",
          onChainError: transaction.onChainError,
          tokenBalanceDecrease: null,
          reconciledRemainingAmount: null,
          solBalanceIncrease: null,
          feePaid: transaction.feeLamports,
          tipPaid: transaction.tipLamports,
          signature: transaction.signature,
          expectedSignature: pending.submission.signature,
          evidence: Object.freeze(transactionEvidence),
        }),
      });

    const balanceResult = await this.balances.observeBalances(
      facts.wallet,
      facts.tokenMint,
      facts.observationRequestedAt,
    );
    if (!balanceResult.ok)
      throw new PositionReconciliationUnavailableError(
        "balance",
        balanceResult.error.code,
        balanceResult.error.retryable,
        balanceResult.error.reason,
      );
    const balance = balanceResult.value;
    const beforeToken = transaction.tokenBalanceBeforeRaw;
    const afterToken = transaction.tokenBalanceAfterRaw;
    const beforeNative = transaction.nativeBalanceBeforeLamports;
    const afterNative = transaction.nativeBalanceAfterLamports;
    const deltasValid =
      beforeToken !== null &&
      afterToken !== null &&
      beforeNative !== null &&
      afterNative !== null &&
      beforeToken === pending.intent.positionAmountBeforeExit &&
      beforeToken >= afterToken &&
      afterToken === balance.tokenBalanceRaw &&
      afterNative >= beforeNative;
    const tokenDecrease = deltasValid ? asRawAmount(beforeToken - afterToken) : null;
    const nativeIncrease = deltasValid ? asRawAmount(afterNative - beforeNative) : null;
    return Object.freeze({
      type: "reconcile",
      stepId: facts.stepId,
      eventId: facts.eventId,
      reconciliation: Object.freeze({
        evaluatedAt: facts.evaluatedAt,
        transactionConfirmed: true,
        onChainError: false,
        tokenBalanceDecrease: tokenDecrease,
        reconciledRemainingAmount: deltasValid ? balance.tokenBalanceRaw : null,
        solBalanceIncrease: nativeIncrease,
        feePaid: transaction.feeLamports,
        tipPaid: deltasValid ? transaction.tipLamports : null,
        signature: transaction.signature,
        expectedSignature: pending.submission.signature,
        evidence: Object.freeze([...transactionEvidence, ...balance.traces.map(evidence)]),
      }),
    });
  }
}
