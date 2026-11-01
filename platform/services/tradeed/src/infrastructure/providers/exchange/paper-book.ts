import type { ExchangeTopOfBook } from "../../../domain/exchange/types.js";

export interface PaperBookQuote {
  readonly side: "buy" | "sell";
  readonly quantity: string;
  readonly executionPrice: string;
  readonly grossNotional: string;
  readonly fee: string;
  readonly spreadBps: number;
  readonly observedAt: Date;
}

export function quoteTopOfBook(
  book: ExchangeTopOfBook,
  side: "buy" | "sell",
  quantityText: string,
  feeBps: number,
  now: Date,
  maximumAgeMs = 2_000,
): PaperBookQuote {
  const quantity = Number(quantityText), bid = Number(book.bidPrice), ask = Number(book.askPrice);
  const available = Number(side === "buy" ? book.askQuantity : book.bidQuantity);
  if (![quantity,bid,ask,available,feeBps].every(Number.isFinite) || quantity <= 0 || bid <= 0 || ask <= bid || available < quantity || feeBps < 0) throw new Error("Paper quote cannot be executed from evidenced top-of-book liquidity");
  if (now.valueOf()-book.receivedAt.valueOf()>maximumAgeMs) throw new Error("Paper quote book is stale");
  const executionPrice=side === "buy" ? ask : bid, gross=executionPrice*quantity, fee=gross*feeBps/10_000;
  return Object.freeze({side,quantity:quantity.toString(),executionPrice:executionPrice.toString(),grossNotional:gross.toString(),fee:fee.toString(),spreadBps:((ask-bid)/((ask+bid)/2))*10_000,observedAt:book.receivedAt});
}
