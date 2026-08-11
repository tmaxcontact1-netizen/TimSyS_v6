import { expect, it } from "vitest";

import {
  allocatePaperSale,
  paperFillHash,
  paperLotId,
  type PaperFill,
} from "../../src/application/services/paper-accounting.js";

const buy = {
  id: "00000000-0000-4000-8000-000000000901",
  wallet: "paper-wallet",
  side: "buy",
  tokenMint: "mint",
  tokenAmountRaw: 100n,
  settlementAmountRaw: 40n,
  quotedAt: "2026-08-10T10:00:00.000Z",
  filledAt: "2026-08-10T10:00:01.000Z",
  quoteFingerprint: "quote-1",
} as PaperFill;

it("derives restart-safe lot and fill identities", () => {
  expect(paperLotId(buy)).toBe(paperLotId(buy));
  expect(paperFillHash(buy)).toMatch(/^[0-9a-f]{64}$/);
});

it("allocates paper sales FIFO with proportional cost release", () => {
  const sale = {
    ...buy,
    id: "00000000-0000-4000-8000-000000000902",
    side: "sell",
    tokenAmountRaw: 120n,
    settlementAmountRaw: 70n,
    quoteFingerprint: "quote-2",
  } as PaperFill;
  expect(
    allocatePaperSale(sale, [
      { id: "lot-1", currentAmountRaw: 100n, remainingCostRaw: 40n },
      { id: "lot-2", currentAmountRaw: 100n, remainingCostRaw: 60n },
    ]),
  ).toEqual([
    { lotId: "lot-1", tokenAmountRaw: 100n, releasedCostRaw: 40n },
    { lotId: "lot-2", tokenAmountRaw: 20n, releasedCostRaw: 12n },
  ]);
});

it("fails closed on impossible or postdated fills", () => {
  expect(() =>
    allocatePaperSale({ ...buy, side: "sell", tokenAmountRaw: 201n } as PaperFill, [
      { id: "lot", currentAmountRaw: 200n, remainingCostRaw: 80n },
    ]),
  ).toThrow(/exceeds/);
  expect(() =>
    paperFillHash({ ...buy, filledAt: "2026-08-10T09:59:59.000Z" } as PaperFill),
  ).toThrow(/predate/);
});
