import { createHash } from "node:crypto";

import { InvariantViolationError } from "../../domain/shared/errors.js";
import {
  asUuid,
  type MintAddress,
  type Timestamp,
  type WalletAddress,
} from "../../domain/shared/types.js";

export interface PaperFill {
  readonly id: string;
  readonly wallet: WalletAddress;
  readonly side: "buy" | "sell";
  readonly tokenMint: MintAddress;
  readonly tokenAmountRaw: bigint;
  readonly settlementAmountRaw: bigint;
  readonly quotedAt: Timestamp;
  readonly filledAt: Timestamp;
  readonly quoteFingerprint: string;
}

export interface PaperLot {
  readonly id: string;
  readonly currentAmountRaw: bigint;
  readonly remainingCostRaw: bigint;
}

export interface PaperDisposal {
  readonly lotId: string;
  readonly tokenAmountRaw: bigint;
  readonly releasedCostRaw: bigint;
}

export interface PaperRealizedPerformance {
  readonly fillId: string;
  readonly proceedsRaw: bigint;
  readonly releasedCostRaw: bigint;
  readonly realizedPnlRaw: bigint;
}

function uuid(...parts: readonly string[]): string {
  const hex = createHash("sha256").update(parts.join("\0")).digest("hex");
  return asUuid(
    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`,
  );
}

export function verifyPaperFill(fill: PaperFill): void {
  if (fill.tokenAmountRaw <= 0n || fill.settlementAmountRaw <= 0n)
    throw new InvariantViolationError("Paper fill amounts must be positive");
  if (fill.quoteFingerprint.trim().length === 0)
    throw new InvariantViolationError("Paper fill requires quote identity");
  if (fill.filledAt < fill.quotedAt)
    throw new InvariantViolationError("Paper fill cannot predate its quote");
}

export function paperLotId(fill: PaperFill): string {
  verifyPaperFill(fill);
  if (fill.side !== "buy") throw new InvariantViolationError("Only a buy fill creates a lot");
  return uuid("paper-lot", fill.wallet, fill.id);
}

export function allocatePaperSale(
  fill: PaperFill,
  lots: readonly PaperLot[],
): readonly PaperDisposal[] {
  verifyPaperFill(fill);
  if (fill.side !== "sell") throw new InvariantViolationError("Lot disposal requires a sell fill");
  if (new Set(lots.map((lot) => lot.id)).size !== lots.length)
    throw new InvariantViolationError("Paper lots must be unique");
  const available = lots.reduce((total, lot) => total + lot.currentAmountRaw, 0n);
  if (available < fill.tokenAmountRaw)
    throw new InvariantViolationError("Paper sale exceeds open lot quantity");
  let required = fill.tokenAmountRaw;
  return Object.freeze(
    lots.flatMap((lot) => {
      if (required === 0n) return [];
      if (lot.currentAmountRaw <= 0n || lot.remainingCostRaw < 0n)
        throw new InvariantViolationError("Paper lot state is invalid");
      const amount = required < lot.currentAmountRaw ? required : lot.currentAmountRaw;
      const cost =
        amount === lot.currentAmountRaw
          ? lot.remainingCostRaw
          : (lot.remainingCostRaw * amount) / lot.currentAmountRaw;
      required -= amount;
      return [{ lotId: lot.id, tokenAmountRaw: amount, releasedCostRaw: cost }];
    }),
  );
}

export function paperFillHash(fill: PaperFill): string {
  verifyPaperFill(fill);
  return createHash("sha256")
    .update(
      JSON.stringify({
        ...fill,
        tokenAmountRaw: fill.tokenAmountRaw.toString(),
        settlementAmountRaw: fill.settlementAmountRaw.toString(),
      }),
    )
    .digest("hex");
}
