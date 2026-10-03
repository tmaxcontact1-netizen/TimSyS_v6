import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import WebSocket from "ws";

import { BinanceRestAdapter } from "../src/infrastructure/providers/exchange/binance-rest.js";
import { BinanceStreamRuntime } from "../src/infrastructure/providers/exchange/stream-runtime.js";
import { EventDeduplicator } from "../src/infrastructure/providers/exchange/continuity.js";
import { loadExchangeAdapterConfiguration } from "../src/infrastructure/providers/exchange/config.js";

const sevenDaysMs = 7 * 24 * 60 * 60 * 1_000;
const configuration = loadExchangeAdapterConfiguration(process.env);
const startedAt = new Date();
const outputDirectory = resolve(process.env.CRYPTOED_SOAK_OUTPUT ?? `diagnostics/exchange-adapter-soak/${startedAt.toISOString().replaceAll(":", "-")}`);
mkdirSync(outputDirectory, { recursive: true });
const eventsFile = resolve(outputDirectory, "events.ndjson");
const summaryFile = resolve(outputDirectory, "summary.json");
const dedupe = new EventDeduplicator(100_000);
const latencies: number[] = [];
const availability: number[] = [];
const lastOpen = new Map<string, number>();
let frames = 0, candles = 0, closedCandles = 0, books = 0, tickers = 0, duplicates = 0, gaps = 0, reconnects = 0, degraded = 0;

const percentile = (values: readonly number[], fraction: number) => values.length === 0 ? null : [...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*fraction))]!;
const snapshot = () => ({
  startedAt: startedAt.toISOString(), observedAt: new Date().toISOString(), elapsedMs: Date.now()-startedAt.valueOf(),
  venue: "binance", symbols: configuration.venueSymbols, frames, candles, closedCandles, books, tickers, duplicates, detectedGaps:gaps, reconnects, degraded,
  transportLatencyP95Ms: percentile(latencies,0.95), closedCandleAvailabilityP95Ms: percentile(availability,0.95),
  completionTargetAt: new Date(startedAt.valueOf()+sevenDaysMs).toISOString(), executionMode:configuration.executionMode,
});
const record = (kind:string, detail:unknown) => appendFileSync(eventsFile,`${JSON.stringify({at:new Date().toISOString(),kind,detail})}\n`);
const writeSnapshot = () => writeFileSync(summaryFile,JSON.stringify(snapshot(),null,2));

const rest = new BinanceRestAdapter(configuration.restBaseUrl, async (url) => fetch(url));
const catalogue = await rest.catalogue(configuration.venueSymbols);
record("catalogue",catalogue);
for(const instrument of catalogue){
  for(const interval of ["1m","5m","15m","1h","4h"] as const){
    const end=Date.now(), start=end-(interval==="4h"?48*60*60_000:interval==="1h"?24*60*60_000:6*60*60_000);
    const values=await rest.candles(instrument.venueSymbol,interval,start,end);
    record("bootstrap",{symbol:instrument.venueSymbol,interval,count:values.length});
  }
}

const runtime = new BinanceStreamRuntime(
  {websocketBaseUrl:configuration.websocketBaseUrl,venueSymbols:configuration.venueSymbols},
  (url)=>{const ws=new WebSocket(url);return {addEventListener:(type,listener)=>ws.on(type,(data)=>listener({data:type==="message"?data.toString():undefined})),close:()=>ws.close()};},
  {
    onCandle:(value)=>{frames++;if(!dedupe.accept(value.fingerprint)){duplicates++;return;}candles++;latencies.push(value.receivedAt.valueOf()-value.eventTime.valueOf());if(value.closed){closedCandles++;availability.push(value.receivedAt.valueOf()-value.closeTime.valueOf());const key=`${value.venueSymbol}:${value.interval}`;const previous=lastOpen.get(key);const step={"1m":60_000,"5m":300_000,"15m":900_000,"1h":3_600_000,"4h":14_400_000}[value.interval];if(previous!==undefined&&value.openTime.valueOf()>previous+step){gaps++;record("gap",{key,previous,current:value.openTime.toISOString()});}lastOpen.set(key,value.openTime.valueOf());}},
    onBook:()=>{frames++;books++;}, onTicker:()=>{frames++;tickers++;},
    onState:(state,detail)=>{if(state==="connected"&&frames>0)reconnects++;if(state==="degraded")degraded++;record("stream-state",{state,detail});},
  },
);
runtime.start();
const interval=setInterval(writeSnapshot,60_000);
const finish=()=>{clearInterval(interval);runtime.stop();writeSnapshot();record("finished",snapshot());process.exit(0);};
setTimeout(finish,sevenDaysMs);
process.on("SIGINT",finish); process.on("SIGTERM",finish);
writeSnapshot();
