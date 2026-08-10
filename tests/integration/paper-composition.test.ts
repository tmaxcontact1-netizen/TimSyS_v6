import { describe, expect, it, vi } from "vitest";

import { composePaperTradingRuntime } from "../../src/entrypoints/composition.js";
import { loadRuntimeConfig } from "../../src/infrastructure/config/load-config.js";

const config = loadRuntimeConfig({
  MEMECOINED_ENV: "test",
  MEMECOINED_MODE: "paper",
  MEMECOINED_INSTANCE_ID: "paper-composition-test",
  MEMECOINED_LOG_LEVEL: "fatal",
  MEMECOINED_CONFIG_DIR: "/etc/memecoined",
  DATABASE_URL: "postgresql://user:pass@localhost/db",
  SOLANA_PRIMARY_RPC_URL: "https://primary.example/rpc",
  SOLANA_FALLBACK_RPC_URL: "https://fallback.example/rpc",
  SOLANA_CLUSTER: "mainnet-beta",
  HELIUS_API_KEY: "helius-key",
  JUPITER_API_KEY: "jupiter-key",
  PAPER_TRADING_WALLET_ADDRESS: "paper-wallet",
  PAPER_INITIAL_CASH_LAMPORTS: "10000000000",
});

describe("paper production composition", () => {
  it("initializes once and schedules paper entries without live position jobs", async () => {
    const statements: string[] = [];
    const database = {
      connect: async () => ({
        query: async (sql: string) => {
          statements.push(sql);
          if (sql.includes("RETURNING j.id::text")) return { rowCount: 0, rows: [] };
          return { rowCount: 1, rows: [] };
        },
        release: () => undefined,
      }),
    };
    const runtime = composePaperTradingRuntime({
      config,
      database: database as never,
      signal: new AbortController().signal,
      providers: { swap: { quote: vi.fn() } },
    });

    await runtime.supervisor.beforeBatch?.();
    await runtime.supervisor.beforeBatch?.();

    expect(statements.filter((sql) => sql.includes("INSERT INTO paper_accounts"))).toHaveLength(1);
    expect(statements.filter((sql) => sql.includes("FOR UPDATE OF j SKIP LOCKED"))).toHaveLength(2);
    await expect(
      runtime.supervisor.jobs.findDue({ now: "2026-08-10" as never, limit: 1 }),
    ).resolves.toEqual([]);
    await expect(runtime.supervisor.run("position" as never)).rejects.toThrow(
      /cannot execute live/,
    );
  });

  it("rejects any execution-enabled authority", () => {
    expect(() =>
      composePaperTradingRuntime({
        config: { ...config, execution: {} } as never,
        database: {} as never,
        signal: new AbortController().signal,
      }),
    ).toThrow(/paper-only/);
  });
});
