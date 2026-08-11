import type { ChainObservationPort } from "../ports/chain.js";
import type { MarketObservationPort } from "../ports/market.js";
import type { PositionWorkerCheckpoint } from "../ports/repositories.js";
import type { EvidenceReference } from "../../domain/shared/evidence.js";
import { InvariantViolationError } from "../../domain/shared/errors.js";
import type {
  MintAddress,
  ProviderId,
  Timestamp,
  WalletAddress,
} from "../../domain/shared/types.js";
import type {
  MonitoringFactFragment,
  ReconciliationFactFragment,
  RuntimeFactFragmentSnapshot,
  RuntimeFactSnapshotSource,
} from "./runtime-fact-producers.js";

export interface LivePositionObservationContext {
  readonly wallet: WalletAddress;
  readonly tokenMint: MintAddress;
}

export interface LivePositionObservationContextSource {
  load(checkpoint: PositionWorkerCheckpoint): Promise<LivePositionObservationContext>;
}

export interface AuthoritativeRuntimeFactSource {
  readonly kind: "wallet" | "security" | "execution";
  readonly provider: ProviderId;
  load(
    checkpoint: PositionWorkerCheckpoint,
    observedAt: Timestamp,
  ): Promise<{
    readonly sourceKey: string;
    readonly facts: MonitoringFactFragment | ReconciliationFactFragment;
  }>;
}

function traceEvidence(trace: {
  readonly evidenceId: EvidenceReference["id"];
  readonly provider: ProviderId;
  readonly respondedAt: Timestamp;
  readonly sourceKey: string;
  readonly contentHash: string;
  readonly slot?: EvidenceReference["slot"];
}): EvidenceReference {
  return Object.freeze({
    id: trace.evidenceId,
    provider: trace.provider,
    observedAt: trace.respondedAt,
    sourceKey: trace.sourceKey,
    contentHash: trace.contentHash,
    ...(trace.slot === undefined ? {} : { slot: trace.slot }),
  });
}

/** Produces live DexScreener evidence; failure remains explicit and blocks publication. */
export class LiveMarketRuntimeFactSource implements RuntimeFactSnapshotSource {
  public constructor(
    private readonly contexts: LivePositionObservationContextSource,
    private readonly market: MarketObservationPort,
  ) {}

  public async collect(
    checkpoint: PositionWorkerCheckpoint,
    observedAt: Timestamp,
  ): Promise<RuntimeFactFragmentSnapshot> {
    const context = await this.contexts.load(checkpoint);
    const result = await this.market.observePrimaryPool(context.tokenMint, observedAt);
    if (!result.ok)
      throw new InvariantViolationError(
        `Live market runtime fact unavailable: ${result.error.code}: ${result.error.reason}`,
      );
    return Object.freeze({
      kind: "market",
      provider: result.value.trace.provider,
      sourceKey: result.value.trace.sourceKey,
      observedAt: result.value.trace.respondedAt,
      phase: "monitor",
      facts: Object.freeze({ evidence: Object.freeze([traceEvidence(result.value.trace)]) }),
    });
  }
}

/** Produces agreed primary/fallback chain evidence; disagreement blocks publication. */
export class LiveChainRuntimeFactSource implements RuntimeFactSnapshotSource {
  public constructor(
    private readonly contexts: LivePositionObservationContextSource,
    private readonly chain: ChainObservationPort,
  ) {}

  public async collect(
    checkpoint: PositionWorkerCheckpoint,
    observedAt: Timestamp,
  ): Promise<RuntimeFactFragmentSnapshot> {
    const context = await this.contexts.load(checkpoint);
    const result = await this.chain.observeBalances(context.wallet, context.tokenMint, observedAt);
    if (!result.ok)
      throw new InvariantViolationError(
        `Live chain runtime fact unavailable: ${result.error.code}: ${result.error.reason}`,
      );
    return Object.freeze({
      kind: "chain",
      provider: "solana_rpc",
      sourceKey: `balance:${context.wallet}:${context.tokenMint}:${result.value.slot.toString()}`,
      observedAt,
      phase: checkpoint.runtimeState.pendingExit === null ? "monitor" : "reconcile",
      facts: Object.freeze({ wallet: context.wallet, tokenMint: context.tokenMint }),
    });
  }
}

/** Adapts completed database intelligence sources without manufacturing absent authority. */
export class AuthoritativeRuntimeFactSnapshotSource implements RuntimeFactSnapshotSource {
  public constructor(private readonly source: AuthoritativeRuntimeFactSource) {}

  public async collect(
    checkpoint: PositionWorkerCheckpoint,
    observedAt: Timestamp,
  ): Promise<RuntimeFactFragmentSnapshot> {
    const phase = checkpoint.runtimeState.pendingExit === null ? "monitor" : "reconcile";
    if (phase === "reconcile" && this.source.kind !== "execution")
      throw new InvariantViolationError(
        "Only execution authority can produce reconciliation facts",
      );
    const loaded = await this.source.load(checkpoint, observedAt);
    if (loaded.sourceKey.trim().length === 0)
      throw new InvariantViolationError("Authoritative runtime fact source key is required");
    return Object.freeze({
      kind: this.source.kind,
      provider: this.source.provider,
      sourceKey: loaded.sourceKey,
      observedAt,
      phase,
      facts: loaded.facts,
    });
  }
}
