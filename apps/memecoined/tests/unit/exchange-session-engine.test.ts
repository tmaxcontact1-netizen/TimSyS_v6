import { describe, expect, it } from "vitest";
import { calculateAsianRange, entriesAllowed, newYorkCivilDate, sessionBoundaries } from "../../src/domain/exchange/session-engine.js";
import type { ExchangeCandle } from "../../src/domain/exchange/types.js";
function candle(openTime:Date,high:number,low:number):ExchangeCandle{return{venue:"binance",venueSymbol:"BTCUSDT",interval:"1h",openTime,closeTime:new Date(openTime.valueOf()+3599999),eventTime:new Date(),receivedAt:new Date(),open:"1",high:String(high),low:String(low),close:"1",baseVolume:"1",quoteVolume:"1",trades:1,closed:true,fingerprint:openTime.toISOString()};}
describe("New York session engine gate",()=>{
 it("resolves winter UTC-5",()=>{const b=sessionBoundaries("2026-01-15");expect(b.asianStart.toISOString()).toBe("2026-01-15T05:00:00.000Z");expect(b.entryStart.toISOString()).toBe("2026-01-15T18:00:00.000Z");});
 it("resolves summer UTC-4",()=>{const b=sessionBoundaries("2026-07-15");expect(b.asianStart.toISOString()).toBe("2026-07-15T04:00:00.000Z");expect(b.entryStart.toISOString()).toBe("2026-07-15T17:00:00.000Z");});
 it("handles spring DST transition",()=>{const b=sessionBoundaries("2026-03-08");expect(b.startOffsetMinutes).toBe(-300);expect(b.endOffsetMinutes).toBe(-240);});
 it("handles autumn DST transition",()=>{const b=sessionBoundaries("2026-11-01");expect(b.startOffsetMinutes).toBe(-240);expect(b.endOffsetMinutes).toBe(-300);});
 it("rejects an invalid civil date",()=>expect(()=>sessionBoundaries("not-a-date")).toThrow("Invalid civil date"));
 it("rejects a normalized but nonexistent civil date",()=>expect(()=>sessionBoundaries("2026-02-31")).toThrow("ambiguous or nonexistent"));
 it("derives New York civil date",()=>expect(newYorkCivilDate(new Date("2026-07-15T03:00:00Z"))).toBe("2026-07-14"));
 it("uses half-open entry window",()=>{const b=sessionBoundaries("2026-07-15");expect(entriesAllowed(b.entryStart,b)).toBe(true);expect(entriesAllowed(b.entryEnd,b)).toBe(false);});
 it("builds provisionally before 08:00",()=>{const b=sessionBoundaries("2026-07-15");expect(calculateAsianRange([candle(b.asianStart,2,1)],b,new Date(b.asianEnd.valueOf()-1)).status).toBe("building");});
 it("locks with eight unique closed hours",()=>{const b=sessionBoundaries("2026-07-15");const c=Array.from({length:8},(_,i)=>candle(new Date(b.asianStart.valueOf()+i*3600000),i+2,1));const r=calculateAsianRange(c,b,b.asianEnd);expect(r.status).toBe("locked");expect(r.high).toBe("9");});
 it("marks missing coverage incomplete",()=>{const b=sessionBoundaries("2026-07-15");expect(calculateAsianRange([candle(b.asianStart,2,1)],b,b.asianEnd).status).toBe("incomplete");});
 it("reports empty pre-session evidence as building",()=>{const b=sessionBoundaries("2026-07-15");expect(calculateAsianRange([],b,new Date(b.asianEnd.valueOf()-1)).status).toBe("building");});
 it("reports empty post-session evidence as incomplete",()=>{const b=sessionBoundaries("2026-07-15");expect(calculateAsianRange([],b,b.asianEnd).status).toBe("incomplete");});
 it("ignores open evidence",()=>{const b=sessionBoundaries("2026-07-15");expect(calculateAsianRange([{...candle(b.asianStart,2,1),closed:false}],b,b.asianEnd).contributingCandles).toBe(0);});
});
