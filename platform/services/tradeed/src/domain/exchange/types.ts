export const exchangeIntervals = ["1m", "5m", "15m", "1h", "4h"] as const;
export type ExchangeInterval = (typeof exchangeIntervals)[number];
export type ExchangeVenue = "binance" | "kraken" | "coinbase";

export interface ExchangeInstrument {
  readonly canonicalAsset: "BTC" | "ETH";
  readonly venue: ExchangeVenue;
  readonly venueSymbol: string;
  readonly baseAsset: string;
  readonly quoteAsset: string;
}

export interface ExchangeCandle {
  readonly venue: ExchangeVenue;
  readonly venueSymbol: string;
  readonly interval: ExchangeInterval;
  readonly openTime: Date;
  readonly closeTime: Date;
  readonly eventTime: Date;
  readonly receivedAt: Date;
  readonly open: string;
  readonly high: string;
  readonly low: string;
  readonly close: string;
  readonly baseVolume: string;
  readonly quoteVolume: string;
  readonly trades: number;
  readonly closed: boolean;
  readonly fingerprint: string;
}

export interface ExchangeTopOfBook {
  readonly venue: ExchangeVenue;
  readonly venueSymbol: string;
  readonly eventTime: Date;
  readonly receivedAt: Date;
  readonly bidPrice: string;
  readonly bidQuantity: string;
  readonly askPrice: string;
  readonly askQuantity: string;
}

export interface ExchangeTicker24h {
  readonly venue: ExchangeVenue;
  readonly venueSymbol: string;
  readonly eventTime: Date;
  readonly receivedAt: Date;
  readonly high: string;
  readonly low: string;
  readonly baseVolume: string;
  readonly quoteVolume: string;
}
