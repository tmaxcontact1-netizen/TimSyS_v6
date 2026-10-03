import { z } from "zod";

const schema=z.object({
  BINANCE_PUBLIC_REST_URL:z.url().default("https://api.binance.com"), BINANCE_PUBLIC_WS_URL:z.url().default("wss://stream.binance.com:9443"),
  CRYPTOED_SYMBOLS:z.string().default("BTCUSDT,ETHUSDT"),
  CRYPTOED_EXECUTION_MODE:z.literal("paper_internal").default("paper_internal"),
  CRYPTOED_REST_CONCURRENCY:z.coerce.number().int().min(1).max(20).default(4),
});
export interface ExchangeAdapterConfiguration { readonly restBaseUrl:string; readonly websocketBaseUrl:string; readonly venueSymbols:readonly string[]; readonly executionMode:"paper_internal"; readonly restConcurrency:number; }
export function loadExchangeAdapterConfiguration(environment:NodeJS.ProcessEnv):ExchangeAdapterConfiguration{
  const value=schema.parse(environment); const venueSymbols=value.CRYPTOED_SYMBOLS.split(",").map(x=>x.trim().toUpperCase()).filter(Boolean);
  if(venueSymbols.length===0) throw new Error("At least one CryptoEd venue symbol is required");
  return Object.freeze({restBaseUrl:value.BINANCE_PUBLIC_REST_URL,websocketBaseUrl:value.BINANCE_PUBLIC_WS_URL,venueSymbols:Object.freeze(venueSymbols),executionMode:value.CRYPTOED_EXECUTION_MODE,restConcurrency:value.CRYPTOED_REST_CONCURRENCY});
}
