import { createHash } from "node:crypto";

import { z } from "zod";

import type { ObservationIdentityFactory } from "../../../application/contracts/observations.js";
import type {
  ConstructedSwap,
  ExactInputQuoteRequest,
  SwapConstructionRequest,
  SwapFailure,
  SwapPort,
  SwapResult,
  SwapSimulation,
} from "../../../application/ports/swap.js";
import type { EvidenceReference } from "../../../domain/shared/evidence.js";
import {
  asBasisPoints,
  asPercentage,
  asRawAmount,
  asSolanaSlot,
  type Timestamp,
} from "../../../domain/shared/types.js";
import { createExecutableQuote, type ExecutableQuote } from "../../../domain/trading/quote.js";
import { JupiterClientError, JupiterSwapApiClient } from "./client.js";

const integer = z.string().regex(/^\d+$/);
const routeStep = z.object({
  swapInfo: z.object({
    ammKey: z.string().min(1),
    label: z.string().min(1).nullable().optional(),
    inputMint: z.string().min(1),
    outputMint: z.string().min(1),
    inAmount: integer,
    outAmount: integer,
    feeAmount: integer,
    feeMint: z.string().min(1),
  }),
  percent: z.number().finite().positive().max(100).optional(),
  bps: z.number().int().positive().max(10_000).optional(),
});
const quoteSchema = z.object({
  inputMint: z.string().min(1),
  inAmount: integer,
  outputMint: z.string().min(1),
  outAmount: integer,
  otherAmountThreshold: integer,
  swapMode: z.literal("ExactIn"),
  slippageBps: z.number().int().nonnegative().max(10_000),
  priceImpactPct: z.string().min(1),
  routePlan: z.array(routeStep).min(1),
  contextSlot: z.number().int().safe().nonnegative().nullable().optional(),
  platformFee: z.null(),
});
const swapSchema = z.object({
  swapTransaction: z.string().min(1),
  lastValidBlockHeight: z.number().int().safe().nonnegative(),
  prioritizationFeeLamports: z.number().int().safe().nonnegative().optional().default(0),
});
const simulationSchema = z.object({
  context: z.object({ slot: z.number().int().safe().nonnegative() }),
  value: z.object({
    err: z.unknown().nullable(),
    logs: z.array(z.string()).nullable().optional(),
    unitsConsumed: z.number().int().safe().nonnegative().nullable().optional(),
  }),
});

export interface SimulationRpcResponse {
  readonly result: unknown;
  readonly raw: unknown;
  readonly receivedAt: Timestamp;
}

export interface TransactionSimulationClient {
  simulateTransaction(serializedTransactionBase64: string): Promise<SimulationRpcResponse>;
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function failure(
  code: SwapFailure["code"],
  provider: SwapFailure["provider"],
  occurredAt: Timestamp,
  reason: string,
  retryable: boolean,
): SwapResult<never> {
  return Object.freeze({
    ok: false,
    error: Object.freeze({ code, provider, occurredAt, reason, retryable }),
  });
}

function evidence(
  identities: ObservationIdentityFactory,
  sourceKey: string,
  observedAt: Timestamp,
  contentHash: string,
  slot?: bigint,
): EvidenceReference {
  return Object.freeze({
    id: identities.createEvidenceId({ provider: "jupiter", sourceKey, contentHash }),
    provider: "jupiter",
    observedAt,
    sourceKey,
    contentHash,
    ...(slot === undefined ? {} : { slot: asSolanaSlot(slot) }),
  });
}

function routeIdentity(step: z.infer<typeof routeStep>): string {
  return [
    step.swapInfo.ammKey,
    step.swapInfo.label ?? "unknown",
    step.swapInfo.inputMint,
    step.swapInfo.outputMint,
    step.swapInfo.inAmount,
    step.swapInfo.outAmount,
    step.swapInfo.feeAmount,
    step.swapInfo.feeMint,
    String(step.bps ?? step.percent),
  ].join(":");
}

function executableFingerprint(input: {
  readonly inputMint: string;
  readonly outputMint: string;
  readonly inputAmount: bigint;
  readonly expectedOutputAmount: bigint;
  readonly minimumOutputAmount: bigint;
  readonly slippageBasisPoints: bigint;
  readonly priceImpactPercentage: { toString(): string } | null;
  readonly routePlan: readonly string[];
  readonly contextSlot: bigint | null;
}): string {
  return hash({
    inputMint: input.inputMint,
    outputMint: input.outputMint,
    inAmount: input.inputAmount.toString(),
    outAmount: input.expectedOutputAmount.toString(),
    otherAmountThreshold: input.minimumOutputAmount.toString(),
    slippageBps: input.slippageBasisPoints.toString(),
    priceImpactPct: input.priceImpactPercentage?.toString() ?? null,
    routePlan: input.routePlan,
    contextSlot: input.contextSlot?.toString() ?? null,
  });
}

function validBase64(value: string): boolean {
  if (value.length === 0 || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value))
    return false;
  return Buffer.from(value, "base64").toString("base64") === value;
}

export class JupiterSwapAdapter implements SwapPort {
  private readonly acceptedQuotes = new Map<string, z.infer<typeof quoteSchema>>();

  public constructor(
    private readonly client: JupiterSwapApiClient,
    private readonly simulation: TransactionSimulationClient,
    private readonly identities: ObservationIdentityFactory,
  ) {}

  private clientFailure(error: unknown, fallbackAt: Timestamp): SwapResult<never> {
    if (error instanceof JupiterClientError)
      return failure(error.code, "jupiter", error.occurredAt, error.message, error.retryable);
    return failure("unavailable", "jupiter", fallbackAt, "Jupiter request failed", true);
  }

  public async quote(request: ExactInputQuoteRequest): Promise<SwapResult<ExecutableQuote>> {
    if (request.inputMint === request.outputMint || request.inputAmount <= 0n)
      return failure("validation", "jupiter", request.requestedAt, "Invalid quote request", false);
    const query = new URLSearchParams({
      inputMint: request.inputMint,
      outputMint: request.outputMint,
      amount: request.inputAmount.toString(),
      slippageBps: request.slippageBasisPoints.toString(),
      swapMode: "ExactIn",
      restrictIntermediateTokens: "true",
    }).toString();
    let response;
    try {
      response = await this.client.quote(query, request.requestedAt);
    } catch (error) {
      return this.clientFailure(error, request.requestedAt);
    }
    const parsed = quoteSchema.safeParse(response.body);
    if (!parsed.success)
      return failure("malformed", "jupiter", response.receivedAt, "Malformed Jupiter quote", false);
    const value = parsed.data;
    if (
      value.inputMint !== request.inputMint ||
      value.outputMint !== request.outputMint ||
      BigInt(value.inAmount) !== request.inputAmount ||
      BigInt(value.slippageBps) !== request.slippageBasisPoints
    )
      return failure(
        "validation",
        "jupiter",
        response.receivedAt,
        "Quote does not match request",
        false,
      );
    try {
      const contentHash = hash({ request: query, response: response.body });
      const sourceKey = `jupiter:swap-v1:quote:${request.inputMint}:${request.outputMint}:${request.inputAmount}`;
      const normalized = {
        inputMint: request.inputMint,
        outputMint: request.outputMint,
        inputAmount: asRawAmount(BigInt(value.inAmount)),
        expectedOutputAmount: asRawAmount(BigInt(value.outAmount)),
        minimumOutputAmount: asRawAmount(BigInt(value.otherAmountThreshold)),
        slippageBasisPoints: asBasisPoints(BigInt(value.slippageBps)),
        priceImpactPercentage: asPercentage(value.priceImpactPct),
        routePlan: Object.freeze(value.routePlan.map(routeIdentity)),
        contextSlot:
          value.contextSlot === null || value.contextSlot === undefined
            ? null
            : asSolanaSlot(BigInt(value.contextSlot)),
      };
      const fingerprint = executableFingerprint(normalized);
      const executable = createExecutableQuote({
        fingerprint,
        ...normalized,
        requestedAt: request.requestedAt,
        receivedAt: response.receivedAt,
        evidence: Object.freeze([
          evidence(
            this.identities,
            sourceKey,
            response.receivedAt,
            contentHash,
            value.contextSlot === null || value.contextSlot === undefined
              ? undefined
              : BigInt(value.contextSlot),
          ),
        ]),
      });
      this.acceptedQuotes.set(fingerprint, value);
      return Object.freeze({
        ok: true,
        value: executable,
      });
    } catch {
      return failure(
        "malformed",
        "jupiter",
        response.receivedAt,
        "Invalid Jupiter quote value",
        false,
      );
    }
  }

  public async construct(request: SwapConstructionRequest): Promise<SwapResult<ConstructedSwap>> {
    const accepted = this.acceptedQuotes.get(request.quote.fingerprint);
    if (
      accepted === undefined ||
      executableFingerprint(request.quote) !== request.quote.fingerprint ||
      accepted.inputMint !== request.quote.inputMint ||
      accepted.outputMint !== request.quote.outputMint ||
      accepted.inAmount !== request.quote.inputAmount.toString() ||
      accepted.outAmount !== request.quote.expectedOutputAmount.toString() ||
      accepted.otherAmountThreshold !== request.quote.minimumOutputAmount.toString()
    )
      return failure(
        "validation",
        "jupiter",
        request.requestedAt,
        "Construction requires the exact accepted quote",
        false,
      );
    const body = {
      quoteResponse: accepted,
      userPublicKey: request.wallet,
      dynamicComputeUnitLimit: true,
      wrapAndUnwrapSol: true,
    };
    let response;
    try {
      response = await this.client.construct(body, request.requestedAt);
    } catch (error) {
      return this.clientFailure(error, request.requestedAt);
    }
    const parsed = swapSchema.safeParse(response.body);
    if (!parsed.success || !validBase64(parsed.data.swapTransaction))
      return failure(
        "malformed",
        "jupiter",
        response.receivedAt,
        "Malformed Jupiter swap transaction",
        false,
      );
    const contentHash = hash({ request: body, response: response.body });
    const sourceKey = `jupiter:swap-v1:transaction:${request.quote.fingerprint}:${request.wallet}`;
    const transactionFingerprint = createHash("sha256")
      .update(Buffer.from(parsed.data.swapTransaction, "base64"))
      .digest("hex");
    return Object.freeze({
      ok: true,
      value: Object.freeze({
        fingerprint: transactionFingerprint,
        quoteFingerprint: request.quote.fingerprint,
        wallet: request.wallet,
        serializedTransactionBase64: parsed.data.swapTransaction,
        lastValidBlockHeight: BigInt(parsed.data.lastValidBlockHeight),
        prioritizationFeeLamports: asRawAmount(BigInt(parsed.data.prioritizationFeeLamports)),
        requestedAt: request.requestedAt,
        receivedAt: response.receivedAt,
        evidence: Object.freeze([
          evidence(this.identities, sourceKey, response.receivedAt, contentHash),
        ]),
      }),
    });
  }

  public async simulate(
    swap: ConstructedSwap,
    requestedAt: Timestamp,
  ): Promise<SwapResult<SwapSimulation>> {
    let response: SimulationRpcResponse;
    try {
      response = await this.simulation.simulateTransaction(swap.serializedTransactionBase64);
    } catch {
      return failure("unavailable", "solana_rpc", requestedAt, "Simulation RPC unavailable", true);
    }
    const parsed = simulationSchema.safeParse(response.result);
    if (!parsed.success)
      return failure("malformed", "solana_rpc", response.receivedAt, "Malformed simulation", false);
    const contentHash = hash({ transactionFingerprint: swap.fingerprint, response: response.raw });
    const sourceKey = `solana_rpc:simulate:${swap.fingerprint}`;
    const succeeded = parsed.data.value.err === null;
    const simulationEvidence = Object.freeze([
      ...swap.evidence,
      evidence(
        this.identities,
        sourceKey,
        response.receivedAt,
        contentHash,
        BigInt(parsed.data.context.slot),
      ),
    ]);
    const value: SwapSimulation = Object.freeze({
      result: Object.freeze({
        succeeded,
        contextSlot: asSolanaSlot(BigInt(parsed.data.context.slot)),
        quoteFingerprint: swap.quoteFingerprint,
      }),
      transactionFingerprint: swap.fingerprint,
      unitsConsumed:
        parsed.data.value.unitsConsumed === null || parsed.data.value.unitsConsumed === undefined
          ? null
          : BigInt(parsed.data.value.unitsConsumed),
      error: parsed.data.value.err,
      logs: Object.freeze([...(parsed.data.value.logs ?? [])]),
      requestedAt,
      receivedAt: response.receivedAt,
      evidence: simulationEvidence,
    });
    if (!succeeded)
      return Object.freeze({
        ok: false,
        error: Object.freeze({
          code: "simulation_failed",
          provider: "solana_rpc",
          occurredAt: response.receivedAt,
          retryable: false,
          reason: `Simulation failed for transaction ${value.transactionFingerprint}`,
        }),
      });
    return Object.freeze({ ok: true, value });
  }
}
