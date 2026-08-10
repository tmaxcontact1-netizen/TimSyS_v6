import { createHash } from "node:crypto";

import type { SwapPort } from "../ports/swap.js";
import { InvariantViolationError } from "../../domain/shared/errors.js";
import {
  asBasisPoints,
  asRawAmount,
  asUuid,
  type MintAddress,
  type Timestamp,
  type WalletAddress,
} from "../../domain/shared/types.js";
import { WRAPPED_SOL_MINT } from "./portfolio-inventory-valuation.js";
import type { PaperFill } from "./paper-accounting.js";

const PAPER_SLIPPAGE_BASIS_POINTS = asBasisPoints(150n);
const MAXIMUM_QUOTE_AGE_MILLISECONDS = 2_000;

export interface PaperFillLedger {
  recordFill(fill: PaperFill): Promise<void>;
}

export interface PaperExecutionRequest {
  readonly side: "buy" | "sell";
  readonly tokenMint: MintAddress;
  readonly inputAmountRaw: bigint;
  readonly requestedAt: Timestamp;
}

export interface PaperEntryLease {
  readonly signalId: string;
  readonly riskRunId: string;
  readonly tokenMint: MintAddress;
  readonly inputAmountRaw: bigint;
  readonly leaseOwner: string;
}

export interface PaperEntryWorkQueue {
  claim(input: {
    readonly ownerId: string;
    readonly now: Timestamp;
    readonly leaseExpiresAt: Timestamp;
    readonly limit: number;
  }): Promise<readonly PaperEntryLease[]>;
  complete(input: { readonly lease: PaperEntryLease; readonly fill: PaperFill }): Promise<void>;
  retry(input: {
    readonly lease: PaperEntryLease;
    readonly availableAt: Timestamp;
    readonly reason: string;
  }): Promise<void>;
}

function fillId(wallet: WalletAddress, side: "buy" | "sell", fingerprint: string): string {
  const hex = createHash("sha256")
    .update(["paper-fill", wallet, side, fingerprint].join("\0"))
    .digest("hex");
  return asUuid(
    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`,
  );
}

export async function runPaperEntryExecutionCycle(input: {
  readonly queue: PaperEntryWorkQueue;
  readonly execution: PaperQuoteExecutionService;
  readonly ownerId: string;
  readonly now: () => Timestamp;
  readonly leaseExpiresAt: (at: Timestamp) => Timestamp;
  readonly retryAt: (at: Timestamp) => Timestamp;
  readonly batchSize?: number;
}): Promise<readonly PaperFill[]> {
  const limit = input.batchSize ?? 25;
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 1_000)
    throw new RangeError("Paper entry batch size must be between 1 and 1000");
  const claimedAt = input.now();
  const leases = await input.queue.claim({
    ownerId: input.ownerId,
    now: claimedAt,
    leaseExpiresAt: input.leaseExpiresAt(claimedAt),
    limit,
  });
  if (leases.length > limit)
    throw new RangeError("Paper entry queue exceeded the requested batch size");
  const fills: PaperFill[] = [];
  for (const lease of leases) {
    try {
      const requestedAt = input.now();
      const fill = await input.execution.execute({
        side: "buy",
        tokenMint: lease.tokenMint,
        inputAmountRaw: lease.inputAmountRaw,
        requestedAt,
      });
      await input.queue.complete({ lease, fill });
      fills.push(fill);
    } catch (error) {
      const failedAt = input.now();
      await input.queue.retry({
        lease,
        availableAt: input.retryAt(failedAt),
        reason: error instanceof Error ? error.message : "Unknown paper entry failure",
      });
    }
  }
  return Object.freeze(fills);
}

export class PaperQuoteExecutionService {
  public constructor(
    private readonly wallet: WalletAddress,
    private readonly quotes: Pick<SwapPort, "quote">,
    private readonly ledger: PaperFillLedger,
    private readonly now: () => Timestamp,
  ) {}

  public async execute(request: PaperExecutionRequest): Promise<PaperFill> {
    if (request.tokenMint === WRAPPED_SOL_MINT)
      throw new InvariantViolationError("Paper trade token must differ from settlement mint");
    if (request.inputAmountRaw <= 0n)
      throw new InvariantViolationError("Paper trade input amount must be positive");
    const inputMint = request.side === "buy" ? WRAPPED_SOL_MINT : request.tokenMint;
    const outputMint = request.side === "buy" ? request.tokenMint : WRAPPED_SOL_MINT;
    const result = await this.quotes.quote({
      inputMint,
      outputMint,
      inputAmount: asRawAmount(request.inputAmountRaw),
      slippageBasisPoints: PAPER_SLIPPAGE_BASIS_POINTS,
      requestedAt: request.requestedAt,
    });
    if (!result.ok)
      throw new Error(`Paper quote unavailable: ${result.error.code}: ${result.error.reason}`);
    const quote = result.value;
    if (
      quote.inputMint !== inputMint ||
      quote.outputMint !== outputMint ||
      quote.inputAmount !== request.inputAmountRaw ||
      quote.slippageBasisPoints !== PAPER_SLIPPAGE_BASIS_POINTS
    )
      throw new InvariantViolationError("Paper quote does not match the requested trade");
    const filledAt = this.now();
    const age = new Date(filledAt).getTime() - new Date(quote.receivedAt).getTime();
    if (age < 0 || age > MAXIMUM_QUOTE_AGE_MILLISECONDS)
      throw new InvariantViolationError("Paper execution requires a fresh quote");
    const fill: PaperFill = Object.freeze({
      id: fillId(this.wallet, request.side, quote.fingerprint),
      wallet: this.wallet,
      side: request.side,
      tokenMint: request.tokenMint,
      tokenAmountRaw: request.side === "buy" ? quote.expectedOutputAmount : quote.inputAmount,
      settlementAmountRaw: request.side === "buy" ? quote.inputAmount : quote.expectedOutputAmount,
      quotedAt: quote.receivedAt,
      filledAt,
      quoteFingerprint: quote.fingerprint,
    });
    await this.ledger.recordFill(fill);
    return fill;
  }
}
