import { randomUUID } from "node:crypto";

import type { Pool } from "pg";

import type { MintAddress, WalletAddress } from "../../domain/shared/types.js";

export interface DashboardWatchlist {
  readonly id: string;
  readonly name: string;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly tokens: readonly string[];
}

interface WatchlistRow {
  readonly id: string;
  readonly name: string;
  readonly version: string | number;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
  readonly tokens: unknown;
}

export class WatchlistConflictError extends Error {}

function timestamp(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function watchlist(row: WatchlistRow): DashboardWatchlist {
  if (!Array.isArray(row.tokens) || row.tokens.some((token) => typeof token !== "string"))
    throw new Error("Invalid dashboard watchlist tokens");
  return Object.freeze({
    id: row.id,
    name: row.name,
    version: Number(row.version),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
    tokens: Object.freeze([...row.tokens]),
  });
}

export async function listDashboardWatchlists(
  database: Pick<Pool, "query">,
  wallet: WalletAddress,
): Promise<readonly DashboardWatchlist[]> {
  const result = await database.query<WatchlistRow>(
    `SELECT w.id,w.name,w.version,w.created_at,w.updated_at,
            COALESCE(jsonb_agg(t.token_mint ORDER BY t.token_mint)
              FILTER (WHERE t.token_mint IS NOT NULL),'[]') AS tokens
     FROM dashboard_watchlists w
     LEFT JOIN dashboard_watchlist_tokens t ON t.watchlist_id=w.id
     WHERE w.wallet=$1 GROUP BY w.id
     ORDER BY w.updated_at DESC,w.id LIMIT 100`,
    [wallet],
  );
  return Object.freeze(result.rows.map(watchlist));
}

async function mutate(
  database: Pick<Pool, "query">,
  sql: string,
  parameters: unknown[],
): Promise<DashboardWatchlist> {
  const result = await database.query<WatchlistRow>(sql, parameters);
  const row = result.rows[0];
  if (row === undefined) throw new WatchlistConflictError("Watchlist version conflict");
  return watchlist(row);
}

export async function createDashboardWatchlist(
  database: Pick<Pool, "query">,
  wallet: WalletAddress,
  name: string,
  occurredAt: Date,
): Promise<DashboardWatchlist> {
  const id = randomUUID();
  const auditId = randomUUID();
  return await mutate(
    database,
    `WITH created AS (
       INSERT INTO dashboard_watchlists (id,wallet,name,created_at,updated_at)
       VALUES ($2,$1,$3,$4,$4) RETURNING *
     ), audited AS (
       INSERT INTO dashboard_mutation_audit
         (id,wallet,watchlist_id,action,resulting_version,payload_json,occurred_at)
       SELECT $5,$1,id,'watchlist_created',version,jsonb_build_object('name',name),$4 FROM created
     )
     SELECT c.id,c.name,c.version,c.created_at,c.updated_at,'[]'::jsonb AS tokens FROM created c`,
    [wallet, id, name, occurredAt, auditId],
  );
}

export async function renameDashboardWatchlist(
  database: Pick<Pool, "query">,
  wallet: WalletAddress,
  id: string,
  name: string,
  expectedVersion: number,
  occurredAt: Date,
): Promise<DashboardWatchlist> {
  return await mutate(
    database,
    `WITH changed AS (
       UPDATE dashboard_watchlists SET name=$4,version=version+1,updated_at=$5
       WHERE wallet=$1 AND id=$2 AND version=$3 RETURNING *
     ), audited AS (
       INSERT INTO dashboard_mutation_audit
         (id,wallet,watchlist_id,action,expected_version,resulting_version,payload_json,occurred_at)
       SELECT $6,$1,id,'watchlist_renamed',$3,version,jsonb_build_object('name',name),$5 FROM changed
     )
     SELECT c.id,c.name,c.version,c.created_at,c.updated_at,
            COALESCE((SELECT jsonb_agg(token_mint ORDER BY token_mint)
                      FROM dashboard_watchlist_tokens WHERE watchlist_id=c.id),'[]') AS tokens
     FROM changed c`,
    [wallet, id, expectedVersion, name, occurredAt, randomUUID()],
  );
}

export async function addDashboardWatchlistToken(
  database: Pick<Pool, "query">,
  wallet: WalletAddress,
  id: string,
  mint: MintAddress,
  expectedVersion: number,
  occurredAt: Date,
): Promise<DashboardWatchlist> {
  return await mutate(
    database,
    `WITH locked AS (
       SELECT id FROM dashboard_watchlists WHERE wallet=$1 AND id=$2 AND version=$3 FOR UPDATE
     ), added AS (
       INSERT INTO dashboard_watchlist_tokens (watchlist_id,token_mint,added_at)
       SELECT id,$4,$5 FROM locked ON CONFLICT DO NOTHING RETURNING watchlist_id
     ), changed AS (
       UPDATE dashboard_watchlists SET version=version+1,updated_at=$5
       WHERE id=(SELECT watchlist_id FROM added) RETURNING *
     ), audited AS (
       INSERT INTO dashboard_mutation_audit
         (id,wallet,watchlist_id,action,expected_version,resulting_version,payload_json,occurred_at)
       SELECT $6,$1,id,'token_added',$3,version,jsonb_build_object('token_mint',$4),$5 FROM changed
     )
     SELECT c.id,c.name,c.version,c.created_at,c.updated_at,
            COALESCE((SELECT jsonb_agg(token_mint ORDER BY token_mint)
                      FROM dashboard_watchlist_tokens WHERE watchlist_id=c.id),'[]') AS tokens
     FROM changed c`,
    [wallet, id, expectedVersion, mint, occurredAt, randomUUID()],
  );
}

export async function removeDashboardWatchlistToken(
  database: Pick<Pool, "query">,
  wallet: WalletAddress,
  id: string,
  mint: MintAddress,
  expectedVersion: number,
  occurredAt: Date,
): Promise<DashboardWatchlist> {
  return await mutate(
    database,
    `WITH locked AS (
       SELECT id FROM dashboard_watchlists WHERE wallet=$1 AND id=$2 AND version=$3 FOR UPDATE
     ), removed AS (
       DELETE FROM dashboard_watchlist_tokens
       WHERE watchlist_id=(SELECT id FROM locked) AND token_mint=$4 RETURNING watchlist_id
     ), changed AS (
       UPDATE dashboard_watchlists SET version=version+1,updated_at=$5
       WHERE id=(SELECT watchlist_id FROM removed) RETURNING *
     ), audited AS (
       INSERT INTO dashboard_mutation_audit
         (id,wallet,watchlist_id,action,expected_version,resulting_version,payload_json,occurred_at)
       SELECT $6,$1,id,'token_removed',$3,version,jsonb_build_object('token_mint',$4),$5 FROM changed
     )
     SELECT c.id,c.name,c.version,c.created_at,c.updated_at,
            COALESCE((SELECT jsonb_agg(token_mint ORDER BY token_mint)
                      FROM dashboard_watchlist_tokens WHERE watchlist_id=c.id),'[]') AS tokens
     FROM changed c`,
    [wallet, id, expectedVersion, mint, occurredAt, randomUUID()],
  );
}

export async function deleteDashboardWatchlist(
  database: Pick<Pool, "query">,
  wallet: WalletAddress,
  id: string,
  expectedVersion: number,
  confirmedName: string,
  occurredAt: Date,
): Promise<void> {
  const result = await database.query(
    `WITH removed AS (
       DELETE FROM dashboard_watchlists
       WHERE wallet=$1 AND id=$2 AND version=$3 AND name=$4 RETURNING id,name,version
     )
     INSERT INTO dashboard_mutation_audit
       (id,wallet,watchlist_id,action,expected_version,payload_json,occurred_at)
     SELECT $6,$1,id,'watchlist_deleted',$3,jsonb_build_object('name',name),$5 FROM removed
     RETURNING watchlist_id`,
    [wallet, id, expectedVersion, confirmedName, occurredAt, randomUUID()],
  );
  if (result.rowCount !== 1) throw new WatchlistConflictError("Watchlist version conflict");
}
