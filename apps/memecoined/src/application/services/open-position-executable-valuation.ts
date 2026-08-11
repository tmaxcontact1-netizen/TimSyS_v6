import { Decimal } from "decimal.js";

import type { SwapPort } from "../ports/swap.js";
import { InvariantViolationError } from "../../domain/shared/errors.js";
import type { EvidenceReference } from "../../domain/shared/evidence.js";
import {
  asBasisPoints,
  asNonNegativeDecimal,
  type DecimalValue,
  type MintAddress,
  type PositionId,
  type RawAmount,
  type Timestamp,
  type WalletAddress,
} from "../../domain/shared/types.js";
import type {
  OpenPositionSafetyFact,
  OpenPositionSafetyFactSource,
} from "./live-operational-safety-sources.js";

const LAMPORTS_PER_SOL = 1_000_000_000;

export interface OpenPositionInventoryFact {
  readonly positionId: PositionId;
  readonly tokenMint: MintAddress;
  readonly settlementMint: MintAddress;
  readonly currentAmount: RawAmount;
  readonly remainingCostBasisSol: DecimalValue;
  readonly evidence: readonly EvidenceReference[];
}

export interface OpenPositionInventoryFactSource {
  observeInventory(requestedAt: Timestamp): Promise<
    Readonly<{
      wallet: WalletAddress;
      observedAt: Timestamp;
      liquidNativeSol: DecimalValue;
      reservedEntryCostSol: DecimalValue;
      usesLeverageOrBorrowing: boolean;
      positions: readonly OpenPositionInventoryFact[];
      evidence: readonly EvidenceReference[];
    }>
  >;
}

/** Adds a current full-exit Jupiter quote to every authoritative open position. */
export class LiveOpenPositionExecutableValuationSource implements OpenPositionSafetyFactSource {
  public constructor(
    private readonly wallet: WalletAddress,
    private readonly inventory: OpenPositionInventoryFactSource,
    private readonly swaps: Pick<SwapPort, "quote">,
  ) {}

  public async observeOpenPositions(requestedAt: Timestamp) {
    const inventory = await this.inventory.observeInventory(requestedAt);
    if (inventory.wallet !== this.wallet || inventory.observedAt !== requestedAt)
      throw new InvariantViolationError(
        "Open position inventory is not same-wallet and same-instant",
      );
    const positions: OpenPositionSafetyFact[] = [];
    for (const position of inventory.positions) {
      if (position.currentAmount <= 0n)
        throw new InvariantViolationError("Open position amount must be positive");
      const result = await this.swaps.quote({
        inputMint: position.tokenMint,
        outputMint: position.settlementMint,
        inputAmount: position.currentAmount,
        slippageBasisPoints: asBasisPoints(150n),
        requestedAt,
      });
      if (!result.ok)
        throw new InvariantViolationError(
          `Executable position valuation unavailable: ${result.error.code}: ${result.error.reason}`,
        );
      const quote = result.value;
      if (
        quote.inputMint !== position.tokenMint ||
        quote.outputMint !== position.settlementMint ||
        quote.inputAmount !== position.currentAmount ||
        quote.requestedAt !== requestedAt
      )
        throw new InvariantViolationError("Executable quote does not match the open position");
      if (
        quote.evidence.length === 0 ||
        quote.evidence.some(({ observedAt }) => observedAt > requestedAt)
      )
        throw new InvariantViolationError(
          "Executable quote requires current non-postdated evidence",
        );
      positions.push(
        Object.freeze({
          positionId: position.positionId,
          remainingCostBasisSol: position.remainingCostBasisSol,
          executableValueSol: asNonNegativeDecimal(
            new Decimal(quote.expectedOutputAmount.toString()).div(LAMPORTS_PER_SOL),
          ),
          reservedEntryCostSol: inventory.reservedEntryCostSol,
          evidence: Object.freeze([...position.evidence, ...quote.evidence]),
        }),
      );
    }
    return Object.freeze({ ...inventory, positions: Object.freeze(positions) });
  }
}
