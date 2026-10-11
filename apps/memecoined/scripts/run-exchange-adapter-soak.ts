import { appendFileSync, mkdirSync, writeFileSync, readFileSync, existsSync, renameSync } from "node:fs";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import WebSocket from "ws";

import { BinanceRestAdapter } from "../src/infrastructure/providers/exchange/binance-rest.js";
import { BinanceStreamRuntime } from "../src/infrastructure/providers/exchange/stream-runtime.js";
import { EventDeduplicator } from "../src/infrastructure/providers/exchange/continuity.js";
import { loadExchangeAdapterConfiguration } from "../src/infrastructure/providers/exchange/config.js";

const sevenDaysMs = 7 * 24 * 60 * 60 * 1_000;
const configuration = loadExchangeAdapterConfiguration(process.env);
const launchedAt = new Date();
const outputDirectory = resolve(process.env.CRYPTOED_SOAK_OUTPUT ?? `diagnostics/exchange-adapter-soak/${launchedAt.toISOString().replaceAll(":", "-")}`);
mkdirSync(outputDirectory, { recursive: true });
const checkpointFile=resolve(outputDirectory,"checkpoint.json");
const configHash=createHash("sha256").update(JSON.stringify(configuration)).digest("hex");
const previous=existsSync(checkpointFile)?JSON.parse(readFileSync(checkpointFile,"utf8")):null;
if(previous&&previous.configHash!==configHash)throw new Error("Soak configuration changed across recovery");
const startedAt=previous?new Date(previous.startedAt):launchedAt;
const eventsFile = resolve(outputDirectory, "events.ndjson");
const summaryFile = resolve(outputDirectory, "summary.json");
const dedupe = new EventDeduplicator(100_000);
const latencies = new Map<number,number>(previous?.latencies ?? []);
const availability = new Map<number,number>(previous?.availability ?? []);
const lastOpen = new Map<string, number>(previous?.lastOpen ?? []);
let frames = 0, candles = 0, closedCandles = 0, books = 0, tickers = 0, duplicates = 0, gaps = 0, reconnects = 0, degraded = 0, futureTimestampFrames = 0;
if(previous){({frames,candles,closedCandles,books,tickers,duplicates,detectedGaps:gaps,reconnects,degraded,futureTimestampFrames}=previous.summary);}

const percentile = (values: Map<number,number>, fraction: number) => {const total=[...values.values()].reduce((a,b)=>a+b,0);if(!total)return null;const rank=Math.min(total-1,Math.floor(total*fraction));let seen=0;for(const [value,count] of [...values].sort((a,b)=>a[0]-b[0])){seen+=count;if(seen>rank)return value;}return null;};
const add=(histogram:Map<number,number>,value:number)=>{const bucket=Math.min(3_600_000,Math.max(0,Math.round(value)));histogram.set(bucket,(histogram.get(bucket)??0)+1);};
const snapshot = () => ({
  startedAt: startedAt.toISOString(), observedAt: new Date().toISOString(), elapsedMs: Date.now()-startedAt.valueOf(),
  venue: "binance", symbols: configuration.venueSymbols, frames, candles, closedCandles, books, tickers, duplicates, detectedGaps:gaps, reconnects, degraded,
  transportLatencyP95Ms: percentile(latencies,0.95), closedCandleAvailabilityP95Ms: percentile(availability,0.95), futureTimestampFrames,
  completionTargetAt: new Date(startedAt.valueOf()+sevenDaysMs).toISOString(), executionMode:configuration.executionMode,
});
const record = (kind:string, detail:unknown) => appendFileSync(eventsFile,`${JSON.stringify({at:new Date().toISOString(),kind,detail})}\n`);
const atomic=(file:string,value:unknown)=>{const temporary=`${file}.${process.pid}.tmp`;writeFileSync(temporary,JSON.stringify(value,null,2));renameSync(temporary,file);};
const writeSnapshot = () => {const summary=snapshot();atomic(checkpointFile,{configHash,startedAt:startedAt.toISOString(),summary,latencies:[...latencies],availability:[...availability],lastOpen:[...lastOpen]});atomic(summaryFile,summary);};
const heartbeat=createServer((_request,response)=>{response.setHeader("Content-Type","application/json");response.end(JSON.stringify({pid:process.pid,frames,at:new Date().toISOString()}));});
if(process.env.CRYPTOED_HEARTBEAT_PORT)heartbeat.listen(Number(process.env.CRYPTOED_HEARTBEAT_PORT),"127.0.0.1");
if(previous)record("recovery",{launchedAt:launchedAt.toISOString(),previousSnapshot:previous.summary.observedAt,configHash});

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
    onCandle:(value)=>{frames++;if(!dedupe.accept(value.fingerprint)){duplicates++;return;}candles++;const transport=value.receivedAt.valueOf()-value.eventTime.valueOf();if(transport<0)futureTimestampFrames++;add(latencies,transport);if(value.closed){const key=`${value.venueSymbol}:${value.interval}`;const previous=lastOpen.get(key);if(previous!==undefined&&value.openTime.valueOf()<=previous)return;closedCandles++;add(availability,value.receivedAt.valueOf()-value.closeTime.valueOf());const step={"1m":60_000,"5m":300_000,"15m":900_000,"1h":3_600_000,"4h":14_400_000}[value.interval];if(previous!==undefined&&value.openTime.valueOf()>previous+step){gaps++;record("gap",{key,previous,current:value.openTime.toISOString()});}lastOpen.set(key,value.openTime.valueOf());}},
    onBook:()=>{frames++;books++;}, onTicker:()=>{frames++;tickers++;},
    onState:(state,detail)=>{if(state==="connected"&&frames>0)reconnects++;if(state==="degraded")degraded++;record("stream-state",{state,detail});},
  },
);
runtime.start();
const interval=setInterval(writeSnapshot,60_000);
const finish=()=>{clearInterval(interval);runtime.stop();writeSnapshot();record("finished",snapshot());process.exit(0);};
setTimeout(finish,Math.max(0,startedAt.valueOf()+sevenDaysMs-Date.now()));
process.on("SIGINT",finish); process.on("SIGTERM",finish);
writeSnapshot();
