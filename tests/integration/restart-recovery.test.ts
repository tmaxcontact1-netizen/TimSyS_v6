import { describe, expect, it } from "vitest";

import type {
  ChainBalanceObservation,
  ObservationResult,
  PoolMarketObservation,
} from "../../src/application/contracts/observations.js";
import type { ChainObservationPort } from "../../src/application/ports/chain.js";
import type { MarketObservationPort } from "../../src/application/ports/market.js";
import type { PositionWorkerCheckpoint } from "../../src/application/ports/repositories.js";
import type {
  AcknowledgePositionAction,
  PendingPositionAction,
  PositionWorkerCheckpointRepository,
  SavePositionWorkerTransition,
} from "../../src/application/ports/repositories.js";
import type {
  PositionMonitoringFacts,
  PositionMonitoringFactsSource,
} from "../../src/application/ports/runtime.js";
import type {
  ConstructedSwap,
  ExactInputQuoteRequest,
  SwapConstructionRequest,
  SwapPort,
  SwapResult,
  SwapSimulation,
} from "../../src/application/ports/swap.js";
import {
  ObservedPositionRuntimeStepSource,
  PositionStepUnavailableError,
} from "../../src/application/services/execution.js";
import { createPositionRuntimeState } from "../../src/application/services/position-monitor.js";
import {
  asBasisPoints,
  asNonNegativeDecimal,
  asPercentage,
  asRawAmount,
  asSolanaSlot,
  asTimestamp,
  asUuid,
  type AuditEventId,
  type Brand,
  type EvidenceId,
  type OrderId,
  type PositionId,
  type ProviderId,
  type TokenId,
  type WalletAddress,
} from "../../src/domain/shared/types.js";
import { asMintAddress } from "../../src/domain/token/token.js";
import { createExecutableQuote, type ExecutableQuote } from "../../src/domain/trading/quote.js";
import {
  applyPositionEvent,
  createEmptyPositionLifecycle,
} from "../../src/domain/trading/position.js";
import { runPositionWorkerCycle } from "../../src/workers/position-worker.js";

function uuid<Value extends Brand<string, string>>(suffix: number): Value {
  return asUuid<Value>(`00000000-0000-4000-8000-${suffix.toString().padStart(12, "0")}`);
}

const requestedAt = asTimestamp("2026-08-04T13:00:00Z");
const receivedAt = asTimestamp("2026-08-04T13:00:01Z");
const evaluatedAt = asTimestamp("2026-08-04T13:00:02Z");
const positionId = uuid<PositionId>(801);
const tokenMint = asMintAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const settlementMint = asMintAddress("So11111111111111111111111111111111111111112");
const wallet = "Wallet111111111111111111111111111111111111" as WalletAddress;

function evidence(id: number, provider: ProviderId, sourceKey: string) {
  return Object.freeze({
    id: uuid<EvidenceId>(id),
    provider,
    observedAt: receivedAt,
    sourceKey,
    contentHash: `${id}`.padStart(64, "0"),
  });
}

function checkpoint(): PositionWorkerCheckpoint {
  const lifecycle = applyPositionEvent(createEmptyPositionLifecycle(), {
    type: "position:opened",
    eventId: uuid<AuditEventId>(802),
    positionId,
    aggregateVersion: 0n,
    occurredAt: asTimestamp("2026-08-04T12:00:00Z"),
    tokenId: uuid<TokenId>(803),
    entryOrderId: uuid<OrderId>(804),
    acquiredAmount: asRawAmount(1_000_000n),
    costBasisSol: asNonNegativeDecimal(1),
  });
  return Object.freeze({
    positionId,
    revision: 0n,
    runtimeState: createPositionRuntimeState(lifecycle),
    pendingAction: null,
  });
}

function facts(overrides: Partial<PositionMonitoringFacts> = {}): PositionMonitoringFacts {
  return Object.freeze({
    stepId: "position-801:monitor:1",
    positionId,
    tokenId: uuid<TokenId>(803),
    observationRequestedAt: requestedAt,
    evaluatedAt,
    wallet,
    tokenMint,
    settlementMint,
    liquidityUsdTenMinutesAgo: asNonNegativeDecimal(100_000),
    developerRelatedSoldPercentage: asNonNegativeDecimal(0),
    originatingTierASoldPercentage: asNonNegativeDecimal(0),
    confirmingTierBSoldPercentages: [asNonNegativeDecimal(0), asNonNegativeDecimal(0)] as const,
    dangerousSecurityChangeDetected: false,
    priorFullExitPriceImpactPercentages: Object.freeze([
      asNonNegativeDecimal(1),
      asNonNegativeDecimal(1.5),
    ]),
    marketDataUnavailableSince: null,
    allChainAccessUnavailableSince: null,
    evidence: Object.freeze([evidence(805, "helius", "persisted:wallet-monitoring")]),
    orderId: uuid<OrderId>(806),
    peakEventId: uuid<AuditEventId>(807),
    exitRequestedEventId: uuid<AuditEventId>(808),
    ...overrides,
  });
}

class Facts implements PositionMonitoringFactsSource {
  public constructor(private readonly value: PositionMonitoringFacts) {}
  public async loadFacts(): Promise<PositionMonitoringFacts> {
    return this.value;
  }
}

function marketObservation(): PoolMarketObservation {
  return Object.freeze({
    mint: tokenMint,
    poolId: "pool-1" as PoolMarketObservation["poolId"],
    pairAddress: "pool-1",
    dexId: "raydium",
    baseMint: tokenMint,
    quoteMint: settlementMint,
    pairCreatedAt: null,
    liquidityUsd: asNonNegativeDecimal(90_000),
    marketCapitalizationUsd: asNonNegativeDecimal(1_000_000),
    fullyDilutedValuationUsd: asNonNegativeDecimal(1_000_000),
    fiveMinuteVolumeUsd: asNonNegativeDecimal(20_000),
    fiveMinuteBuys: 10n,
    fiveMinuteSells: 5n,
    fiveMinutePriceChangePercentage: asNonNegativeDecimal(2),
    trace: Object.freeze({
      evidenceId: uuid<EvidenceId>(809),
      provider: "dexscreener",
      method: "GET token pairs",
      requestedAt,
      respondedAt: receivedAt,
      sourceTimestamp: null,
      normalizedAt: receivedAt,
      sourceKey: "dexscreener:pool-1",
      contentHash: "9".repeat(64),
    }),
  });
}

function chainObservation(amount = 1_000_000n): ChainBalanceObservation {
  return Object.freeze({
    wallet,
    mint: tokenMint,
    nativeBalanceLamports: asRawAmount(2_000_000_000n),
    tokenBalanceRaw: asRawAmount(amount),
    slot: asSolanaSlot(100n),
    agreeingProviders: Object.freeze(["helius", "solana_rpc"] as const),
    traces: Object.freeze(
      (["helius", "solana_rpc"] as const).map((provider, index) =>
        Object.freeze({
          evidenceId: uuid<EvidenceId>(810 + index),
          provider,
          method: "balances",
          requestedAt,
          respondedAt: receivedAt,
          sourceTimestamp: null,
          normalizedAt: receivedAt,
          sourceKey: `${provider}:balances`,
          contentHash: `${index + 1}`.repeat(64),
          slot: asSolanaSlot(100n),
        }),
      ),
    ),
  });
}

function executableQuote(): ExecutableQuote {
  return createExecutableQuote({
    fingerprint: "a".repeat(64),
    inputMint: tokenMint,
    outputMint: settlementMint,
    inputAmount: asRawAmount(1_000_000n),
    expectedOutputAmount: asRawAmount(1_300_000_000n),
    minimumOutputAmount: asRawAmount(1_280_500_000n),
    slippageBasisPoints: asBasisPoints(150n),
    priceImpactPercentage: asPercentage(2),
    routePlan: Object.freeze(["amm-1:Raydium"]),
    contextSlot: asSolanaSlot(100n),
    requestedAt,
    receivedAt,
    evidence: Object.freeze([evidence(812, "jupiter", "jupiter:quote")]),
  });
}

function constructed(quote: ExecutableQuote): ConstructedSwap {
  return Object.freeze({
    fingerprint: "b".repeat(64),
    quoteFingerprint: quote.fingerprint,
    wallet,
    serializedTransactionBase64: Buffer.from("transaction").toString("base64"),
    lastValidBlockHeight: 1_000n,
    prioritizationFeeLamports: asRawAmount(5_000n),
    requestedAt,
    receivedAt,
    evidence: Object.freeze([evidence(813, "jupiter", "jupiter:construction")]),
  });
}

function swapSimulation(quote: ExecutableQuote): SwapSimulation {
  return Object.freeze({
    result: Object.freeze({
      succeeded: true,
      contextSlot: asSolanaSlot(101n),
      quoteFingerprint: quote.fingerprint,
    }),
    transactionFingerprint: "b".repeat(64),
    unitsConsumed: 100_000n,
    error: null,
    logs: Object.freeze(["success"]),
    requestedAt,
    receivedAt,
    evidence: Object.freeze([evidence(814, "solana_rpc", "solana:simulation")]),
  });
}

function fixture(
  options: { marketFailure?: boolean; chainAmount?: bigint; simulationOk?: boolean } = {},
) {
  const quoteRequests: ExactInputQuoteRequest[] = [];
  const constructionRequests: SwapConstructionRequest[] = [];
  const quote = executableQuote();
  const market: MarketObservationPort = {
    observePrimaryPool: async (): Promise<ObservationResult<PoolMarketObservation>> =>
      options.marketFailure === true
        ? Object.freeze({
            ok: false,
            error: Object.freeze({
              code: "rate_limited",
              provider: "dexscreener",
              occurredAt: evaluatedAt,
              retryable: true,
              reason: "limited",
            }),
          })
        : Object.freeze({ ok: true, value: marketObservation() }),
  };
  const chain: ChainObservationPort = {
    observeBalances: async (): Promise<ObservationResult<ChainBalanceObservation>> =>
      Object.freeze({ ok: true, value: chainObservation(options.chainAmount) }),
  };
  const swap: SwapPort = {
    quote: async (request): Promise<SwapResult<ExecutableQuote>> => {
      quoteRequests.push(request);
      return Object.freeze({ ok: true, value: quote });
    },
    construct: async (request): Promise<SwapResult<ConstructedSwap>> => {
      constructionRequests.push(request);
      return Object.freeze({ ok: true, value: constructed(quote) });
    },
    simulate: async (): Promise<SwapResult<SwapSimulation>> => {
      const value = swapSimulation(quote);
      return Object.freeze({
        ok: true,
        value:
          options.simulationOk === false
            ? Object.freeze({
                ...value,
                result: Object.freeze({ ...value.result, succeeded: false }),
              })
            : value,
      });
    },
  };
  return {
    source: new ObservedPositionRuntimeStepSource(new Facts(facts()), market, chain, swap),
    quoteRequests,
    constructionRequests,
  };
}

describe("observed position runtime step source", () => {
  it("assembles authoritative observations, quote, construction and simulation", async () => {
    const value = fixture();
    const step = await value.source.nextStep(checkpoint());
    expect(step.type).toBe("monitor");
    if (step.type !== "monitor") return;
    expect(step.snapshot.executableValueSol?.toString()).toBe("1.3");
    expect(step.snapshot.emergency.liquidityUsd?.toString()).toBe("90000");
    expect(step.snapshot.emergency.fullExitPriceImpactPercentages?.map(String)).toEqual([
      "1",
      "1.5",
      "2",
    ]);
    expect(step.snapshot.emergency.unexplainedBalanceDiscrepancy).toBe(false);
    expect(step.preparation).toMatchObject({
      quoteFingerprint: "a".repeat(64),
      sellRouteValid: true,
      simulationSucceeded: true,
    });
    expect(step.snapshot.evidence.map(({ provider }) => provider)).toEqual([
      "helius",
      "dexscreener",
      "helius",
      "solana_rpc",
      "jupiter",
      "jupiter",
      "solana_rpc",
    ]);
    expect(value.quoteRequests[0]).toMatchObject({
      inputMint: tokenMint,
      outputMint: settlementMint,
      inputAmount: 1_000_000n,
      slippageBasisPoints: 150n,
    });
    expect(value.constructionRequests[0]).toMatchObject({ wallet });
  });

  it("turns an authoritative balance mismatch into EMG-008 input", async () => {
    const value = fixture({ chainAmount: 999_999n });
    const step = await value.source.nextStep(checkpoint());
    expect(step.type === "monitor" && step.snapshot.emergency.unexplainedBalanceDiscrepancy).toBe(
      true,
    );
  });

  it("drives the durable worker with the fully assembled immutable step", async () => {
    const value = fixture();
    class MemoryRepository implements PositionWorkerCheckpointRepository {
      public current = checkpoint();
      public saved: SavePositionWorkerTransition | null = null;
      public async load(): Promise<PositionWorkerCheckpoint> {
        return this.current;
      }
      public async saveTransition(
        input: SavePositionWorkerTransition,
      ): Promise<PositionWorkerCheckpoint> {
        this.saved = input;
        this.current = Object.freeze({
          positionId,
          revision: 1n,
          runtimeState: input.runtimeState,
          pendingAction: input.pendingAction,
        });
        return this.current;
      }
      public async acknowledgeAction(
        _input: AcknowledgePositionAction,
      ): Promise<PositionWorkerCheckpoint> {
        this.current = Object.freeze({ ...this.current, revision: 2n, pendingAction: null });
        return this.current;
      }
    }
    const repository = new MemoryRepository();
    const delivered: PendingPositionAction[] = [];
    const result = await runPositionWorkerCycle(positionId, {
      checkpoints: repository,
      steps: value.source,
      actions: { dispatch: async (pending) => void delivered.push(pending) },
    });
    expect(result.action.type).toBe("submit_exit");
    expect(repository.saved?.emittedEvents.map(({ type }) => type)).toEqual([
      "position:executable-peak-recorded",
      "position:exit-requested",
    ]);
    expect(delivered).toHaveLength(1);
    expect(delivered[0]?.action).toMatchObject({
      type: "submit_exit",
      execution: {
        transactionFingerprint: "b".repeat(64),
        quoteFingerprint: "a".repeat(64),
        wallet,
        lastValidBlockHeight: 1_000n,
      },
    });
    expect(result.checkpoint).toMatchObject({ revision: 2n, pendingAction: null });
  });

  it("does not claim simulation success when the provider reports failure", async () => {
    const value = fixture({ simulationOk: false });
    await expect(value.source.nextStep(checkpoint())).rejects.toMatchObject({
      stage: "simulation",
      code: "simulation_failed",
      retryable: false,
    });
  });

  it("classifies provider failure without creating a partial runtime step", async () => {
    const value = fixture({ marketFailure: true });
    await expect(value.source.nextStep(checkpoint())).rejects.toMatchObject({
      name: "PositionStepUnavailableError",
      stage: "market_observation",
      code: "rate_limited",
      retryable: true,
    } satisfies Partial<PositionStepUnavailableError>);
    expect(value.quoteRequests).toEqual([]);
  });

  it("rejects monitoring when an exit is already pending reconciliation", async () => {
    const value = fixture();
    const current = checkpoint();
    const forged = Object.freeze({
      ...current,
      runtimeState: Object.freeze({
        ...current.runtimeState,
        pendingExit: Object.freeze({ intent: {}, decision: {} }),
      }),
    }) as unknown as PositionWorkerCheckpoint;
    await expect(value.source.nextStep(forged)).rejects.toThrow();
  });

  it("rejects monitoring facts bound to a different token aggregate", async () => {
    const source = new ObservedPositionRuntimeStepSource(
      new Facts(facts({ tokenId: uuid<TokenId>(899) })),
      // These ports must never be reached after the identity rejection.
      { observePrimaryPool: async () => Promise.reject(new Error("unexpected market call")) },
      { observeBalances: async () => Promise.reject(new Error("unexpected chain call")) },
      {
        quote: async () => Promise.reject(new Error("unexpected quote call")),
        construct: async () => Promise.reject(new Error("unexpected construction call")),
        simulate: async () => Promise.reject(new Error("unexpected simulation call")),
      },
    );
    await expect(source.nextStep(checkpoint())).rejects.toThrow("different position or token");
  });
});
