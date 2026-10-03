import { createHash } from "node:crypto";

import {
  exchangeIntervals,
  type ExchangeCandle,
  type ExchangeInterval,
  type ExchangeTicker24h,
  type ExchangeTopOfBook,
} from "../../../domain/exchange/types.js";

type Json = Record<string, unknown>;
const intervalSet = new Set<string>(exchangeIntervals);
const text = (value: unknown, name: string) => {
  if (typeof value !== "string" || value.length === 0) throw new Error(`Invalid Binance ${name}`);
  return value;
};
const number = (value: unknown, name: string) => {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Invalid Binance ${name}`);
  return value;
};
const record = (value: unknown, name: string): Json => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`Invalid Binance ${name}`);
  return value as Json;
};
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function binanceCombinedStreams(venueSymbols: readonly string[]): readonly string[] {
  return Object.freeze(
    venueSymbols.flatMap((venueSymbol) => {
      const symbol = venueSymbol.toLowerCase();
      return [
        ...exchangeIntervals.map((interval) => `${symbol}@kline_${interval}`),
        `${symbol}@bookTicker`,
        `${symbol}@ticker`,
      ];
    }),
  );
}

function payload(input: unknown): Json {
  const outer = record(input, "event");
  return "data" in outer ? record(outer.data, "combined payload") : outer;
}

export function parseBinanceKline(input: unknown, receivedAt: Date): ExchangeCandle {
  const value = payload(input);
  if (value.e !== "kline") throw new Error("Binance event is not a kline");
  const candle = record(value.k, "kline payload");
  const interval = text(candle.i, "interval");
  if (!intervalSet.has(interval)) throw new Error(`Unsupported Binance interval: ${interval}`);
  const parsed = Object.freeze({
    venue: "binance" as const,
    venueSymbol: text(value.s, "symbol"),
    interval: interval as ExchangeInterval,
    openTime: new Date(number(candle.t, "open time")),
    closeTime: new Date(number(candle.T, "close time")),
    eventTime: new Date(number(value.E, "event time")),
    receivedAt,
    open: text(candle.o, "open"), high: text(candle.h, "high"), low: text(candle.l, "low"), close: text(candle.c, "close"),
    baseVolume: text(candle.v, "base volume"), quoteVolume: text(candle.q, "quote volume"),
    trades: number(candle.n, "trade count"), closed: candle.x === true,
    fingerprint: hash(value),
  });
  if ([parsed.openTime, parsed.closeTime, parsed.eventTime].some((date) => Number.isNaN(date.valueOf()))) throw new Error("Invalid Binance timestamp");
  return parsed;
}

export function parseBinanceBookTicker(input: unknown, receivedAt: Date): ExchangeTopOfBook {
  const value = payload(input);
  return Object.freeze({
    venue: "binance", venueSymbol: text(value.s, "symbol"),
    eventTime: new Date(typeof value.E === "number" ? value.E : receivedAt.valueOf()), receivedAt,
    bidPrice: text(value.b, "bid price"), bidQuantity: text(value.B, "bid quantity"),
    askPrice: text(value.a, "ask price"), askQuantity: text(value.A, "ask quantity"),
  });
}

export function parseBinanceTicker24h(input: unknown, receivedAt: Date): ExchangeTicker24h {
  const value = payload(input);
  if (value.e !== "24hrTicker") throw new Error("Binance event is not a 24-hour ticker");
  return Object.freeze({
    venue: "binance", venueSymbol: text(value.s, "symbol"), eventTime: new Date(number(value.E, "event time")), receivedAt,
    high: text(value.h, "high"), low: text(value.l, "low"), baseVolume: text(value.v, "base volume"), quoteVolume: text(value.q, "quote volume"),
  });
}

export interface ExchangeStreamSink {
  onCandle(candle: ExchangeCandle): Promise<void> | void;
  onBook(book: ExchangeTopOfBook): Promise<void> | void;
  onTicker(ticker: ExchangeTicker24h): Promise<void> | void;
  onState(state: "connecting" | "connected" | "disconnected" | "degraded", detail: string): Promise<void> | void;
}

export interface SocketLike {
  addEventListener(type: "open" | "message" | "close" | "error", listener: (event: { data?: unknown }) => void): void;
  close(): void;
}

export type SocketFactory = (url: string) => SocketLike;
export interface BinanceStreamConfig { readonly websocketBaseUrl: string; readonly venueSymbols: readonly string[]; }

/** Binance market-data transport. Scheduling/reconnect ownership remains outside this parser-focused adapter. */
export class BinanceMarketDataAdapter {
  public constructor(private readonly config: BinanceStreamConfig, private readonly sockets: SocketFactory, private readonly sink: ExchangeStreamSink, private readonly now = () => new Date()) {}
  public connect(): SocketLike {
    const streams = binanceCombinedStreams(this.config.venueSymbols).join("/");
    const socket = this.sockets(`${this.config.websocketBaseUrl.replace(/\/$/,"")}/stream?streams=${streams}`);
    void this.sink.onState("connecting", "binance-public");
    socket.addEventListener("open", () => void this.sink.onState("connected", "binance-public"));
    socket.addEventListener("close", () => void this.sink.onState("disconnected", "binance-public"));
    socket.addEventListener("error", () => void this.sink.onState("degraded", "binance-public"));
    socket.addEventListener("message", (event) => {
      try {
        const raw = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        const data = payload(raw);
        const receivedAt = this.now();
        if (data.e === "kline") void this.sink.onCandle(parseBinanceKline(raw, receivedAt));
        else if (data.e === "24hrTicker") void this.sink.onTicker(parseBinanceTicker24h(raw, receivedAt));
        else if ("b" in data && "a" in data) void this.sink.onBook(parseBinanceBookTicker(raw, receivedAt));
      } catch (error) {
        void this.sink.onState("degraded", error instanceof Error ? error.message : "invalid Binance event");
      }
    });
    return socket;
  }
}
