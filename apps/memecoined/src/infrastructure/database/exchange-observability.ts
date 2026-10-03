import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
export class ExchangeObservabilityRepository {
 public constructor(private readonly pool:Pick<Pool,"query">,private readonly continuitySegment:string){}
 public async record(venue:string,eventType:string,occurredAt:Date,detail:Readonly<Record<string,unknown>>={},options:{symbol?:string;latencyMs?:number;httpStatus?:number;retryAfterMs?:number}={}):Promise<void>{await this.pool.query(`INSERT INTO exchange_stream_events(id,venue,venue_symbol,event_type,occurred_at,continuity_segment,latency_ms,http_status,retry_after_ms,detail_json) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[randomUUID(),venue,options.symbol??null,eventType,occurredAt,this.continuitySegment,options.latencyMs??null,options.httpStatus??null,options.retryAfterMs??null,JSON.stringify(detail)]);}
}
