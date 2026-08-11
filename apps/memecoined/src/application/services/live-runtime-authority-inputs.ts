import type { ChainObservationPort, ChainTransactionObservationPort } from "../ports/chain.js";
import type {
  MintSecurityObservationPort,
  PositionRuntimeAuthorityBaseline,
  RuntimeAuthorityBaselineSource,
} from "../ports/runtime-authority-inputs.js";
import type { PositionWorkerCheckpoint } from "../ports/repositories.js";
import { InvariantViolationError } from "../../domain/shared/errors.js";
import type { Timestamp } from "../../domain/shared/types.js";
import type {
  MonitoringRuntimeAuthorityInputSource,
  ReconciliationRuntimeAuthorityInputSource,
} from "./runtime-authority-production.js";

export class LiveMonitoringRuntimeAuthorityInputSource implements MonitoringRuntimeAuthorityInputSource {
  public constructor(
    private readonly baselines: RuntimeAuthorityBaselineSource,
    private readonly balances: ChainObservationPort,
    private readonly security: MintSecurityObservationPort,
  ) {}

  public async load(input: {
    readonly checkpoint: PositionWorkerCheckpoint;
    readonly observedAt: Timestamp;
  }) {
    const baseline = await this.baselines.load(input.checkpoint.positionId);
    if (baseline.capturedAt > input.observedAt)
      throw new InvariantViolationError("Authority baseline cannot be from the future");
    const tracked = [
      ...baseline.developerRelated,
      ...(baseline.originatingTierA === null ? [] : [baseline.originatingTierA]),
      ...(baseline.confirmingTierB === null ? [] : baseline.confirmingTierB),
    ];
    const current = await Promise.all(
      tracked.map(async (entry) => {
        const result = await this.balances.observeBalances(
          entry.wallet,
          baseline.tokenMint,
          input.observedAt,
        );
        if (!result.ok)
          throw new InvariantViolationError(
            `Tracked wallet balance unavailable: ${result.error.code}`,
          );
        return Object.freeze({ ...entry, currentBalanceRaw: result.value.tokenBalanceRaw });
      }),
    );
    const byWallet = new Map(current.map((item) => [item.wallet, item]));
    const resolve = (entry: PositionRuntimeAuthorityBaseline["originatingTierA"]) =>
      entry === null ? null : (byWallet.get(entry.wallet) ?? null);
    const tierB =
      baseline.confirmingTierB === null
        ? null
        : (baseline.confirmingTierB.map((entry) =>
            byWallet.get(entry.wallet)!,
          ) as unknown as readonly [(typeof current)[number], (typeof current)[number]]);
    return Object.freeze({
      context: Object.freeze({
        wallet: baseline.wallet,
        tokenMint: baseline.tokenMint,
        settlementMint: baseline.settlementMint,
      }),
      history: baseline.history,
      wallets: Object.freeze({
        developerRelated: Object.freeze(
          baseline.developerRelated.map((entry) => byWallet.get(entry.wallet)!),
        ),
        originatingTierA: resolve(baseline.originatingTierA),
        confirmingTierB: tierB,
      }),
      entrySecurity: baseline.entrySecurity,
      currentSecurity: await this.security.observe(
        baseline.tokenMint,
        baseline.excludedHolderTokenAccounts,
        input.observedAt,
      ),
    });
  }
}

export class LiveReconciliationRuntimeAuthorityInputSource implements ReconciliationRuntimeAuthorityInputSource {
  public constructor(
    private readonly baselines: RuntimeAuthorityBaselineSource,
    private readonly transactions: ChainTransactionObservationPort,
  ) {}

  public async load(input: {
    readonly checkpoint: PositionWorkerCheckpoint;
    readonly observedAt: Timestamp;
  }) {
    const baseline = await this.baselines.load(input.checkpoint.positionId);
    const signature = input.checkpoint.runtimeState.pendingExit?.submission?.signature;
    if (signature === undefined)
      throw new InvariantViolationError("Reconciliation signature is required");
    const result = await this.transactions.observeTransaction(
      signature,
      baseline.wallet,
      baseline.tokenMint,
      input.observedAt,
    );
    if (!result.ok)
      throw new InvariantViolationError(`Confirmed execution unavailable: ${result.error.code}`);
    if (result.value.state !== "confirmed" || result.value.onChainError !== false)
      throw new InvariantViolationError("Execution is not confirmed successfully on chain");
    return Object.freeze({ wallet: baseline.wallet, tokenMint: baseline.tokenMint });
  }
}
