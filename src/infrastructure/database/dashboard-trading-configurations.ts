import { randomUUID } from "node:crypto";

import type { Pool } from "pg";

import type { WalletAddress } from "../../domain/shared/types.js";

export interface DashboardTradingConfigurationValues {
  readonly strategyVersionId: string;
  readonly maximumConcurrentPositions: number;
  readonly riskPerTradeBps: number;
  readonly maximumPositionEquityBps: number;
  readonly maximumOpenExposureBps: number;
  readonly minimumUncommittedEquityBps: number;
  readonly entrySlippageBps: number;
}

export interface DashboardTradingConfiguration extends DashboardTradingConfigurationValues {
  readonly id: string;
  readonly name: string;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface ConfigurationRow {
  readonly id: string;
  readonly name: string;
  readonly strategy_version_id: string;
  readonly maximum_concurrent_positions: number;
  readonly risk_per_trade_bps: number;
  readonly maximum_position_equity_bps: number;
  readonly maximum_open_exposure_bps: number;
  readonly minimum_uncommitted_equity_bps: number;
  readonly entry_slippage_bps: number;
  readonly version: string | number;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
}

export class TradingConfigurationConflictError extends Error {}

function timestamp(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function configuration(row: ConfigurationRow): DashboardTradingConfiguration {
  return Object.freeze({
    id: row.id,
    name: row.name,
    strategyVersionId: row.strategy_version_id,
    maximumConcurrentPositions: row.maximum_concurrent_positions,
    riskPerTradeBps: row.risk_per_trade_bps,
    maximumPositionEquityBps: row.maximum_position_equity_bps,
    maximumOpenExposureBps: row.maximum_open_exposure_bps,
    minimumUncommittedEquityBps: row.minimum_uncommitted_equity_bps,
    entrySlippageBps: row.entry_slippage_bps,
    version: Number(row.version),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
  });
}

const columns = `id,name,strategy_version_id,maximum_concurrent_positions,risk_per_trade_bps,
  maximum_position_equity_bps,maximum_open_exposure_bps,minimum_uncommitted_equity_bps,
  entry_slippage_bps,version,created_at,updated_at`;

export async function listDashboardTradingConfigurations(
  database: Pick<Pool, "query">,
  wallet: WalletAddress,
): Promise<readonly DashboardTradingConfiguration[]> {
  const result = await database.query<ConfigurationRow>(
    `SELECT ${columns} FROM dashboard_trading_configurations
     WHERE wallet=$1 ORDER BY updated_at DESC,id LIMIT 100`,
    [wallet],
  );
  return Object.freeze(result.rows.map(configuration));
}

async function mutate(
  database: Pick<Pool, "query">,
  sql: string,
  parameters: unknown[],
): Promise<DashboardTradingConfiguration> {
  const result = await database.query<ConfigurationRow>(sql, parameters);
  const row = result.rows[0];
  if (row === undefined)
    throw new TradingConfigurationConflictError("Trading configuration version conflict");
  return configuration(row);
}

export async function createDashboardTradingConfiguration(
  database: Pick<Pool, "query">,
  wallet: WalletAddress,
  name: string,
  values: DashboardTradingConfigurationValues,
  occurredAt: Date,
): Promise<DashboardTradingConfiguration> {
  return await mutate(
    database,
    `WITH created AS (
       INSERT INTO dashboard_trading_configurations
         (id,wallet,name,strategy_version_id,maximum_concurrent_positions,risk_per_trade_bps,
          maximum_position_equity_bps,maximum_open_exposure_bps,minimum_uncommitted_equity_bps,
          entry_slippage_bps,created_at,updated_at)
       VALUES ($2,$1,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11) RETURNING *
     ), audited AS (
       INSERT INTO dashboard_trading_configuration_audit
         (id,wallet,configuration_id,action,resulting_version,payload_json,occurred_at)
       SELECT $12,$1,id,'configuration_created',version,to_jsonb(created)-'wallet'-'created_at'-'updated_at',$11
       FROM created
     ) SELECT ${columns} FROM created`,
    [
      wallet,
      randomUUID(),
      name,
      values.strategyVersionId,
      values.maximumConcurrentPositions,
      values.riskPerTradeBps,
      values.maximumPositionEquityBps,
      values.maximumOpenExposureBps,
      values.minimumUncommittedEquityBps,
      values.entrySlippageBps,
      occurredAt,
      randomUUID(),
    ],
  );
}

export async function updateDashboardTradingConfiguration(
  database: Pick<Pool, "query">,
  wallet: WalletAddress,
  id: string,
  expectedVersion: number,
  name: string,
  values: DashboardTradingConfigurationValues,
  occurredAt: Date,
): Promise<DashboardTradingConfiguration> {
  return await mutate(
    database,
    `WITH changed AS (
       UPDATE dashboard_trading_configurations SET
         name=$4,strategy_version_id=$5,maximum_concurrent_positions=$6,risk_per_trade_bps=$7,
         maximum_position_equity_bps=$8,maximum_open_exposure_bps=$9,
         minimum_uncommitted_equity_bps=$10,entry_slippage_bps=$11,
         version=version+1,updated_at=$12
       WHERE wallet=$1 AND id=$2 AND version=$3 RETURNING *
     ), audited AS (
       INSERT INTO dashboard_trading_configuration_audit
         (id,wallet,configuration_id,action,expected_version,resulting_version,payload_json,occurred_at)
       SELECT $13,$1,id,'configuration_updated',$3,version,to_jsonb(changed)-'wallet'-'created_at'-'updated_at',$12
       FROM changed
     ) SELECT ${columns} FROM changed`,
    [
      wallet,
      id,
      expectedVersion,
      name,
      values.strategyVersionId,
      values.maximumConcurrentPositions,
      values.riskPerTradeBps,
      values.maximumPositionEquityBps,
      values.maximumOpenExposureBps,
      values.minimumUncommittedEquityBps,
      values.entrySlippageBps,
      occurredAt,
      randomUUID(),
    ],
  );
}

export async function deleteDashboardTradingConfiguration(
  database: Pick<Pool, "query">,
  wallet: WalletAddress,
  id: string,
  expectedVersion: number,
  confirmedName: string,
  occurredAt: Date,
): Promise<void> {
  const result = await database.query(
    `WITH removed AS (
       DELETE FROM dashboard_trading_configurations
       WHERE wallet=$1 AND id=$2 AND version=$3 AND name=$4 RETURNING *
     ) INSERT INTO dashboard_trading_configuration_audit
       (id,wallet,configuration_id,action,expected_version,payload_json,occurred_at)
     SELECT $6,$1,id,'configuration_deleted',$3,to_jsonb(removed)-'wallet'-'created_at'-'updated_at',$5
     FROM removed RETURNING configuration_id`,
    [wallet, id, expectedVersion, confirmedName, occurredAt, randomUUID()],
  );
  if (result.rowCount !== 1)
    throw new TradingConfigurationConflictError("Trading configuration version conflict");
}
