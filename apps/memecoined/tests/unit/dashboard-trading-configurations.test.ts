import { describe, expect, it } from "vitest";

import {
  createDashboardTradingConfiguration,
  listDashboardTradingConfigurations,
  TradingConfigurationConflictError,
  updateDashboardTradingConfiguration,
} from "../../src/infrastructure/database/dashboard-trading-configurations.js";

const values = Object.freeze({
  strategyVersionId: "strategy-v1.0.0",
  maximumConcurrentPositions: 3,
  riskPerTradeBps: 50,
  maximumPositionEquityBps: 500,
  maximumOpenExposureBps: 1000,
  minimumUncommittedEquityBps: 5000,
  entrySlippageBps: 150,
});

const row = {
  id: "123e4567-e89b-42d3-a456-426614174000",
  name: "Conservative paper",
  strategy_version_id: "strategy-v1.0.0",
  maximum_concurrent_positions: 3,
  risk_per_trade_bps: 50,
  maximum_position_equity_bps: 500,
  maximum_open_exposure_bps: 1000,
  minimum_uncommitted_equity_bps: 5000,
  entry_slippage_bps: 150,
  version: "2",
  created_at: "2026-08-10T10:00:00Z",
  updated_at: "2026-08-10T11:00:00Z",
};

describe("dashboard trading configurations", () => {
  it("returns immutable bounded wallet-scoped configurations", async () => {
    let sql = "";
    let parameters: unknown[] | undefined;
    const database = {
      query: async (statement: string, supplied: unknown[]) => {
        sql = statement;
        parameters = supplied;
        return { rows: [row] };
      },
    };
    const configurations = await listDashboardTradingConfigurations(
      database as never,
      "wallet" as never,
    );
    expect(parameters).toEqual(["wallet"]);
    expect(sql).toContain("LIMIT 100");
    expect(configurations[0]).toMatchObject({
      id: row.id,
      name: row.name,
      version: 2,
      ...values,
    });
    expect(Object.isFrozen(configurations)).toBe(true);
    expect(Object.isFrozen(configurations[0])).toBe(true);
  });

  it("creates an atomic configuration and audit fact", async () => {
    let sql = "";
    let parameters: unknown[] = [];
    const database = {
      query: async (statement: string, supplied: unknown[]) => {
        sql = statement;
        parameters = supplied;
        return { rows: [{ ...row, version: 1 }] };
      },
    };
    const created = await createDashboardTradingConfiguration(
      database as never,
      "wallet" as never,
      row.name,
      values,
      new Date("2026-08-10T11:00:00Z"),
    );
    expect(created.version).toBe(1);
    expect(sql).toContain("configuration_created");
    expect(parameters).toContain("strategy-v1.0.0");
    expect(parameters).toContain(150);
  });

  it("fails closed when a versioned update changes nothing", async () => {
    const database = { query: async () => ({ rows: [] }) };
    await expect(
      updateDashboardTradingConfiguration(
        database as never,
        "wallet" as never,
        row.id,
        3,
        row.name,
        values,
        new Date("2026-08-10T12:00:00Z"),
      ),
    ).rejects.toBeInstanceOf(TradingConfigurationConflictError);
  });
});
