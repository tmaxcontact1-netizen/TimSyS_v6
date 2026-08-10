import { describe, expect, it } from "vitest";

import {
  composeProductionPortfolioCheckpointPublication,
  composeProductionPositionRuntime,
} from "../../src/entrypoints/composition.js";
import { loadRuntimeConfig } from "../../src/infrastructure/config/load-config.js";

const config = loadRuntimeConfig({
  MEMECOINED_ENV: "test",
  MEMECOINED_MODE: "supervised_live",
  MEMECOINED_INSTANCE_ID: "composition-test",
  MEMECOINED_LOG_LEVEL: "fatal",
  MEMECOINED_CONFIG_DIR: "/etc/memecoined",
  DATABASE_URL: "postgresql://user:pass@localhost/db",
  SOLANA_PRIMARY_RPC_URL: "https://primary.example/rpc",
  SOLANA_FALLBACK_RPC_URL: "https://fallback.example/rpc",
  SOLANA_CLUSTER: "mainnet-beta",
  HELIUS_API_KEY: "helius-key",
  JUPITER_API_KEY: "jupiter-key",
  TRADING_WALLET_SECRET_FILE: "/run/secrets/wallet.json",
  TRANSACTION_ALLOWED_PROGRAM_IDS: "program-a,program-b",
  TRANSACTION_ALLOWED_FEE_RECIPIENTS: "fee-a",
  TRANSACTION_ALLOWED_DESTINATIONS: "destination-a",
  TRANSACTION_MAX_PRIORITY_FEE_LAMPORTS: "500000",
});

describe("zero-placeholder position composition", () => {
  it("constructs facts, providers, inspection, dispatch, and supervision from config", () => {
    const runtime = composeProductionPositionRuntime({
      config,
      database: { query: async () => ({ rows: [], rowCount: 0 }) } as never,
      signal: new AbortController().signal,
    });
    expect(runtime.checkpoints).toBeDefined();
    expect(runtime.supervisor.jobs).toBeDefined();
    expect(runtime.supervisor.run).toBeTypeOf("function");
    expect(runtime.supervisor.beforeBatch).toBeTypeOf("function");
  });

  it("composes portfolio publication only with explicit operational authority", () => {
    const publication = composeProductionPortfolioCheckpointPublication({
      database: {} as never,
      providers: {
        inventory: {} as never,
        market: {} as never,
        walletHistory: {} as never,
      },
      wallet: "wallet-authority" as never,
      operations: { observe: async () => Promise.reject(new Error("unavailable")) },
    });
    expect(publication.publish).toBeTypeOf("function");
  });

  it("rejects a non-execution configuration", () => {
    expect(() =>
      composeProductionPositionRuntime({
        config: { ...config, execution: null } as never,
        database: {} as never,
        signal: new AbortController().signal,
      }),
    ).toThrow(/execution configuration/);
  });
});
