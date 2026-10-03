import WebSocket from "ws";
import type { Pool } from "pg";
import { randomUUID } from "node:crypto";

import { ExchangeMarketDataRepository } from "../../database/exchange-market-data.js";
import { ExchangeObservabilityRepository } from "../../database/exchange-observability.js";
import { BinanceRestAdapter } from "./binance-rest.js";
import { loadExchangeAdapterConfiguration } from "./config.js";
import { ExchangeIngestionService } from "./ingestion.js";
import { BinanceStreamRuntime } from "./stream-runtime.js";

export interface CryptoMarketDataControl { stop(): Promise<void>; }

/** Binds the persisted Crypto'Ed switch to public-data ingestion. It has no order/execution capability. */
export function startCryptoMarketDataControl(database: Pool, environment: NodeJS.ProcessEnv, signal: AbortSignal): CryptoMarketDataControl {
  const configuration=loadExchangeAdapterConfiguration(environment);
  let stream:BinanceStreamRuntime|null=null, repairTimer:ReturnType<typeof setInterval>|null=null, stopped=false, transition=Promise.resolve();
  const continuitySegment=randomUUID();
  const market=new ExchangeMarketDataRepository(database,continuitySegment);
  const telemetry=new ExchangeObservabilityRepository(database,continuitySegment);
  const rest=new BinanceRestAdapter(configuration.restBaseUrl,async(url)=>fetch(url));
  const store={
    saveCandle:(value:Parameters<typeof market.saveCandle>[0],source:"websocket"|"rest_backfill")=>market.saveCandle(value,source),
    saveBook:(value:Parameters<typeof market.saveBook>[0])=>market.saveBook(value),
    saveTicker:(value:Parameters<typeof market.saveTicker>[0])=>market.saveTicker(value),
    recordStreamEvent:(state:string,detail:string,occurredAt:Date)=>telemetry.record("binance",state,occurredAt,{detail}),
  };
  const ingestion=new ExchangeIngestionService(store,rest);
  const start=async()=>{
    if(stream||stopped)return;
    const catalogue=await rest.catalogue(configuration.venueSymbols);
    await telemetry.record("binance","catalogue_verified",new Date(),{instruments:catalogue});
    stream=new BinanceStreamRuntime({websocketBaseUrl:configuration.websocketBaseUrl,venueSymbols:configuration.venueSymbols},(url)=>{
      const socket=new WebSocket(url);
      return {addEventListener:(type,listener)=>socket.on(type,(data)=>listener({data:type==="message"?data.toString():undefined})),close:()=>socket.close()};
    },ingestion);
    stream.start();
    repairTimer=setInterval(()=>void ingestion.repairNext().catch((error)=>telemetry.record("binance","backfill_failed",new Date(),{message:error instanceof Error?error.message:"unknown"})),1_000);
  };
  const stop=async()=>{stream?.stop();stream=null;if(repairTimer)clearInterval(repairTimer);repairTimer=null;};
  const reconcile=async()=>{const result=await database.query<{enabled:boolean}>(`SELECT enabled FROM tradeed_segment_controls WHERE segment_id='cryptoed'`);if(result.rows[0]?.enabled)await start();else await stop();};
  const poll=setInterval(()=>{transition=transition.then(reconcile).catch((error)=>telemetry.record("binance","control_failed",new Date(),{message:error instanceof Error?error.message:"unknown"}));},5_000);
  transition=transition.then(reconcile);
  signal.addEventListener("abort",()=>{clearInterval(poll);stopped=true;transition=transition.then(stop);},{once:true});
  return {stop:async()=>{clearInterval(poll);stopped=true;await transition;await stop();}};
}
