import type { ExchangeCandle, ExchangeTicker24h, ExchangeTopOfBook } from "../../../domain/exchange/types.js";
import type { ExchangeStreamSink } from "./binance.js";
import type { BinanceRestClient } from "./binance-rest.js";
import { BackfillCoordinator, CandleContinuityTracker, EventDeduplicator } from "./continuity.js";

export interface ExchangeIngestionStore {
  saveCandle(value: ExchangeCandle, source: "websocket" | "rest_backfill"): Promise<void>;
  saveBook(value: ExchangeTopOfBook): Promise<void>;
  saveTicker(value: ExchangeTicker24h): Promise<void>;
  recordStreamEvent(state: string, detail: string, occurredAt: Date): Promise<void>;
}

/** Provider-neutral ingestion boundary; it persists truth before exposing data to future playbooks. */
export class ExchangeIngestionService implements ExchangeStreamSink {
  readonly #continuity = new CandleContinuityTracker();
  readonly #dedupe = new EventDeduplicator();
  readonly #backfills = new BackfillCoordinator();
  public constructor(private readonly store: ExchangeIngestionStore, private readonly rest: BinanceRestClient, private readonly now = () => new Date()) {}
  public get backfillDepth(): number { return this.#backfills.depth; }
  public async onCandle(candle: ExchangeCandle): Promise<void> {
    if (!this.#dedupe.accept(candle.fingerprint)) return;
    await this.store.saveCandle(candle, "websocket");
    const gap = this.#continuity.observe(candle);
    if (gap) this.#backfills.enqueue(gap, candle.interval === "1m" ? 100 : 10);
  }
  public async onBook(book: ExchangeTopOfBook): Promise<void> { await this.store.saveBook(book); }
  public async onTicker(ticker: ExchangeTicker24h): Promise<void> { await this.store.saveTicker(ticker); }
  public async onState(state: string, detail: string): Promise<void> { await this.store.recordStreamEvent(state, detail, this.now()); }
  public async repairNext(): Promise<number> {
    const gap = this.#backfills.next(); if (!gap) return 0;
    const candles = await this.rest.candles(gap.venueSymbol, gap.interval, gap.startTime, gap.endTime);
    for (const candle of candles) await this.store.saveCandle(candle, "rest_backfill");
    return candles.length;
  }
}
