import type { ExchangeCandle, ExchangeInstrument, ExchangeInterval } from "../../../domain/exchange/types.js";
import { parseBinanceKline } from "./binance.js";
import { retryAfterMilliseconds } from "./reliability.js";

export class ExchangeRateLimitError extends Error { public constructor(public readonly status:number,public readonly retryAfterMs:number|null){super(`Exchange request rejected with HTTP ${status}`);} }
export interface HttpResponse { readonly ok:boolean; readonly status:number; readonly headers:{get(name:string):string|null}; json():Promise<unknown>; }
export type HttpClient=(url:string)=>Promise<HttpResponse>;
export interface BinanceRestClient { candles(symbol:string,interval:ExchangeInterval,startTime:number,endTime:number):Promise<readonly ExchangeCandle[]>; }
type Json=Record<string,unknown>;
const record=(value:unknown):Json=>{if(typeof value!=="object"||value===null||Array.isArray(value))throw new Error("Invalid exchange metadata");return value as Json;};

export class BinanceRestAdapter {
 public constructor(private readonly baseUrl:string,private readonly http:HttpClient,private readonly now=()=>new Date()){}
 private async get(path:string):Promise<unknown>{const response=await this.http(`${this.baseUrl.replace(/\/$/,"")}${path}`);if(response.status===429||response.status===418)throw new ExchangeRateLimitError(response.status,retryAfterMilliseconds(response.headers.get("retry-after")));if(!response.ok)throw new Error(`Binance HTTP ${response.status}`);return response.json();}
 public async catalogue(symbols:readonly string[]):Promise<readonly ExchangeInstrument[]>{const data=record(await this.get(`/api/v3/exchangeInfo?symbols=${encodeURIComponent(JSON.stringify(symbols))}`));if(!Array.isArray(data.symbols))throw new Error("Binance metadata omitted symbols");return Object.freeze(data.symbols.map(item=>{const x=record(item);if(x.status!=="TRADING")throw new Error(`Binance product ${String(x.symbol)} is not trading`);if(typeof x.symbol!=="string"||typeof x.baseAsset!=="string"||typeof x.quoteAsset!=="string")throw new Error("Invalid Binance product metadata");if(x.baseAsset!=="BTC"&&x.baseAsset!=="ETH")throw new Error(`Unsupported canonical asset ${x.baseAsset}`);return Object.freeze({canonicalAsset:x.baseAsset,venue:"binance" as const,venueSymbol:x.symbol,baseAsset:x.baseAsset,quoteAsset:x.quoteAsset});}));}
 public async candles(symbol:string,interval:ExchangeInterval,startTime:number,endTime:number):Promise<readonly ExchangeCandle[]>{const raw=await this.get(`/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&startTime=${startTime}&endTime=${endTime}&limit=1000`);if(!Array.isArray(raw))throw new Error("Invalid Binance candle backfill");return Object.freeze(raw.map(row=>{if(!Array.isArray(row)||row.length<11)throw new Error("Invalid Binance candle row");return parseBinanceKline({e:"kline",E:this.now().valueOf(),s:symbol,k:{t:row[0],T:row[6],i:interval,o:row[1],h:row[2],l:row[3],c:row[4],v:row[5],q:row[7],n:row[8],x:true}},this.now());}));}
}
