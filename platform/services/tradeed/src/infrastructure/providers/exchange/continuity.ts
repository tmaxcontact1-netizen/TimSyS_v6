import type { ExchangeCandle, ExchangeInterval } from "../../../domain/exchange/types.js";
import { BoundedPriorityQueue } from "./reliability.js";
const intervalMs:Readonly<Record<ExchangeInterval,number>>=Object.freeze({"1m":60_000,"5m":300_000,"15m":900_000,"1h":3_600_000,"4h":14_400_000});
export interface CandleGap { readonly venueSymbol:string; readonly interval:ExchangeInterval; readonly startTime:number; readonly endTime:number; }
export class CandleContinuityTracker {
 readonly #last=new Map<string,number>();
 public observe(candle:ExchangeCandle):CandleGap|null{if(!candle.closed)return null;const key=`${candle.venue}:${candle.venueSymbol}:${candle.interval}`;const previous=this.#last.get(key);this.#last.set(key,Math.max(previous??candle.openTime.valueOf(),candle.openTime.valueOf()));if(previous===undefined)return null;const step=intervalMs[candle.interval];return candle.openTime.valueOf()>previous+step?Object.freeze({venueSymbol:candle.venueSymbol,interval:candle.interval,startTime:previous+step,endTime:candle.openTime.valueOf()-step}):null;}
}
export class BackfillCoordinator {
 readonly #queue=new BoundedPriorityQueue<CandleGap>(64);
 public enqueue(gap:CandleGap,priority:number):CandleGap|null{return this.#queue.push(gap,priority);}
 public next():CandleGap|null{return this.#queue.shift();}
 public get depth():number{return this.#queue.size;}
}
export class EventDeduplicator {
 readonly #seen=new Map<string,number>();
 public constructor(private readonly capacity=20_000){}
 public accept(fingerprint:string):boolean{if(this.#seen.has(fingerprint))return false;this.#seen.set(fingerprint,Date.now());while(this.#seen.size>this.capacity)this.#seen.delete(this.#seen.keys().next().value!);return true;}
}
