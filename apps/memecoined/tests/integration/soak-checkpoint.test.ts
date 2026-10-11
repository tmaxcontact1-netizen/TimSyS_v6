import { afterEach, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("../../src/infrastructure/providers/exchange/binance-rest.js",()=>({BinanceRestAdapter:class{async catalogue(){return [];} }}));
vi.mock("../../src/infrastructure/providers/exchange/stream-runtime.js",()=>({BinanceStreamRuntime:class{
  constructor(_config:unknown,_factory:unknown,private sink:any){}
  start(){this.sink.onCandle({fingerprint:"fixture",venueSymbol:"BTCUSDT",interval:"1m",closed:true,receivedAt:new Date("2026-10-11T10:01:00.100Z"),eventTime:new Date("2026-10-11T10:01:00Z"),openTime:new Date("2026-10-11T10:00:00Z"),closeTime:new Date("2026-10-11T10:00:59.999Z")});}
  stop(){}
}}));
const directories:string[]=[];
const originalListeners={SIGINT:process.listeners("SIGINT"),SIGTERM:process.listeners("SIGTERM")};
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();for(const event of ["SIGINT","SIGTERM"] as const)for(const listener of process.listeners(event))if(!originalListeners[event].includes(listener))process.removeListener(event,listener);for(const directory of directories.splice(0))rmSync(directory,{recursive:true,force:true});});
it("recovers original start, counts, percentile histogram and closed-candle watermark after module restart",async()=>{
  const directory=mkdtempSync(join(tmpdir(),"tradeed-checkpoint-"));directories.push(directory);
  vi.stubEnv("CRYPTOED_SOAK_OUTPUT",directory);vi.useFakeTimers();vi.setSystemTime(new Date("2026-10-11T10:01:01Z"));
  await import("../../scripts/run-exchange-adapter-soak.js");
  const first=JSON.parse(readFileSync(join(directory,"checkpoint.json"),"utf8"));
  expect(first.summary.closedCandles).toBe(1);expect(first.summary.transportLatencyP95Ms).toBe(100);
  vi.clearAllTimers();vi.resetModules();vi.setSystemTime(new Date("2026-10-11T10:02:01Z"));
  await import("../../scripts/run-exchange-adapter-soak.js");
  const second=JSON.parse(readFileSync(join(directory,"checkpoint.json"),"utf8"));
  expect(second.startedAt).toBe(first.startedAt);expect(second.configHash).toBe(first.configHash);
  expect(second.summary.closedCandles).toBe(1);expect(second.summary.frames).toBe(2);
  expect(second.summary.transportLatencyP95Ms).toBe(100);expect(second.lastOpen).toEqual(first.lastOpen);
  expect(readFileSync(join(directory,"events.ndjson"),"utf8")).toContain('"kind":"recovery"');
});
